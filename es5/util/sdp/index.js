'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var _a = require('../'), difference = _a.difference, flatMap = _a.flatMap;
var setSimulcastInMediaSection = require('./simulcast');
var ptToFixedBitrateAudioCodecName = {
    0: 'PCMU',
    8: 'PCMA'
};
/**
 * A payload type
 * @typedef {number} PT
 */
/**
 * An {@link AudioCodec} or {@link VideoCodec}
 * @typedef {AudioCodec|VideoCodec} Codec
 */
/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<Codec, Array<PT>>}
 */
function createCodecMapForMediaSection(section) {
    return Array.from(createPtToCodecName(section)).reduce(function (codecMap, pair) {
        var pt = pair[0];
        var codecName = pair[1];
        var pts = codecMap.get(codecName) || [];
        return codecMap.set(codecName, pts.concat(pt));
    }, new Map());
}
/**
 * Create a Map of MIDs to m= sections for the given SDP.
 * @param {string} sdp
 * @returns {Map<string, string>}
 */
function createMidToMediaSectionMap(sdp) {
    return getMediaSections(sdp).reduce(function (midsToMediaSections, mediaSection) {
        var mid = getMidForMediaSection(mediaSection);
        return mid ? midsToMediaSections.set(mid, mediaSection) : midsToMediaSections;
    }, new Map());
}
/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
    return getPayloadTypesInMediaSection(mediaSection).reduce(function (ptToCodecName, pt) {
        var rtpmapPattern = new RegExp("a=rtpmap:" + pt + " ([^/]+)");
        var matches = mediaSection.match(rtpmapPattern);
        var codecName = matches
            ? matches[1].toLowerCase()
            : ptToFixedBitrateAudioCodecName[pt]
                ? ptToFixedBitrateAudioCodecName[pt].toLowerCase()
                : '';
        return ptToCodecName.set(pt, codecName);
    }, new Map());
}
/**
 * Get the associated fmtp attributes for the given Payload Type in an m= section.
 * @param {PT} pt
 * @param {string} mediaSection
 * @returns {?object}
 */
function getFmtpAttributesForPt(pt, mediaSection) {
    // In "a=fmtp:<pt> <name>=<value>[;<name>=<value>]*", the regex matches the codec
    // profile parameters expressed as name/value pairs separated by ";".
    var fmtpRegex = new RegExp("^a=fmtp:" + pt + " (.+)$", 'm');
    var matches = mediaSection.match(fmtpRegex);
    return matches && matches[1].split(';').reduce(function (attrs, nvPair) {
        var _a = __read(nvPair.split('='), 2), name = _a[0], value = _a[1];
        attrs[name] = isNaN(value) ? value : parseInt(value, 10);
        return attrs;
    }, {});
}
/**
 * Get the MID for the given m= section.
 * @param {string} mediaSection
 * @return {?string}
 */
function getMidForMediaSection(mediaSection) {
    // In "a=mid:<mid>", the regex matches <mid>.
    var midMatches = mediaSection.match(/^a=mid:(.+)$/m);
    return midMatches && midMatches[1];
}
/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
    return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) { return "m=" + mediaSection; }).filter(function (mediaSection) {
        var kindPattern = new RegExp("m=" + (kind || '.*'), 'gm');
        var directionPattern = new RegExp("a=" + (direction || '.*'), 'gm');
        return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
    });
}
/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PT>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
    var mLine = section.split('\r\n')[0];
    // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
    // the regex matches <port> and the Payload Types.
    var matches = mLine.match(/([0-9]+)/g);
    // This should not happen, but in case there are no Payload Types in
    // the m= line, return an empty array.
    if (!matches) {
        return [];
    }
    // Since only the Payload Types are needed, we discard the <port>.
    return matches.slice(1).map(function (match) { return parseInt(match, 10); });
}
/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<AudioCodecSettings|VideoCodecSettings>} preferredCodecs - Preferred Codecs
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
    preferredCodecs = preferredCodecs.map(function (_a) {
        var codec = _a.codec;
        return codec.toLowerCase();
    });
    var preferredPayloadTypes = flatMap(preferredCodecs, function (codecName) { return codecMap.get(codecName) || []; });
    var remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
    var remainingPayloadTypes = flatMap(remainingCodecs, function (codecName) { return codecMap.get(codecName); });
    return preferredPayloadTypes.concat(remainingPayloadTypes);
}
/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
    var lines = section.split('\r\n');
    var mLine = lines[0];
    var otherLines = lines.slice(1);
    mLine = mLine.replace(/([0-9]+\s?)+$/, payloadTypes.join(' '));
    return [mLine].concat(otherLines).join('\r\n');
}
/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredAudioCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @param {Array<VideoCodecSettings>} preferredVideoCodecs - If empty, the
 *   existing order of video codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredAudioCodecs, preferredVideoCodecs) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (section) {
        // Codec preferences should not be applied to m=application sections.
        if (!/^m=(audio|video)/.test(section)) {
            return section;
        }
        var kind = section.match(/^m=(audio|video)/)[1];
        var codecMap = createCodecMapForMediaSection(section);
        var preferredCodecs = kind === 'audio' ? preferredAudioCodecs : preferredVideoCodecs;
        var payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
        var newSection = setPayloadTypesInMediaSection(payloadTypes, section);
        var pcmaPayloadTypes = codecMap.get('pcma') || [];
        var pcmuPayloadTypes = codecMap.get('pcmu') || [];
        var fixedBitratePayloadTypes = kind === 'audio'
            ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes))
            : new Set();
        return fixedBitratePayloadTypes.has(payloadTypes[0])
            ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '')
            : newSection;
    })).join('\r\n');
}
/**
 * Return a new SDP string with simulcast settings.
 * @param {string} sdp
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes
 * @returns {string} Updated SDP string
 */
function setSimulcast(sdp, trackIdsToAttributes) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (section) {
        section = section.replace(/\r\n$/, '');
        if (!/^m=video/.test(section)) {
            return section;
        }
        var codecMap = createCodecMapForMediaSection(section);
        var payloadTypes = getPayloadTypesInMediaSection(section);
        var vp8PayloadTypes = new Set(codecMap.get('vp8') || []);
        var hasVP8PayloadType = payloadTypes.some(function (payloadType) { return vp8PayloadTypes.has(payloadType); });
        return hasVP8PayloadType
            ? setSimulcastInMediaSection(section, trackIdsToAttributes)
            : section;
    })).concat('').join('\r\n');
}
/**
 * Get the matching Payload Types in an m= section for a particular peer codec.
 * @param {Codec} peerCodec
 * @param {PT} peerPt
 * @param {Map<Codec, PT>} codecsToPts
 * @param {string} section
 * @param {string} peerSection
 * @returns {Array<PT>}
 */
function getMatchingPayloadTypes(peerCodec, peerPt, codecsToPts, section, peerSection) {
    // If there is at most one local Payload Type that matches the remote codec, retain it.
    var matchingPts = codecsToPts.get(peerCodec) || [];
    if (matchingPts.length <= 1) {
        return matchingPts;
    }
    // If there are no fmtp attributes for the codec in the peer m= section, then we
    // cannot get a match in the  m= section. In that case, retain all matching Payload
    // Types.
    var peerFmtpAttrs = getFmtpAttributesForPt(peerPt, peerSection);
    if (!peerFmtpAttrs) {
        return matchingPts;
    }
    // Among the matched local Payload Types, find the one that matches the remote
    // fmtp attributes.
    var matchingPt = matchingPts.find(function (pt) {
        var fmtpAttrs = getFmtpAttributesForPt(pt, section);
        return fmtpAttrs && Object.keys(peerFmtpAttrs).every(function (attr) {
            return peerFmtpAttrs[attr] === fmtpAttrs[attr];
        });
    });
    // If none of the matched Payload Types also have matching fmtp attributes,
    // then retain all of them, otherwise retain only the Payload Type that
    // matches the peer fmtp attributes.
    return typeof matchingPt === 'number' ? [matchingPt] : matchingPts;
}
/**
 * Filter codecs in an m= section based on its peer m= section from the other peer.
 * @param {string} section
 * @param {Map<string, string>} peerMidsToMediaSections
 * @param {Array<string>} codecsToRemove
 * @returns {string}
 */
function filterCodecsInMediaSection(section, peerMidsToMediaSections, codecsToRemove) {
    // Do nothing if the m= section represents neither audio nor video.
    if (!/^m=(audio|video)/.test(section)) {
        return section;
    }
    // Do nothing if the m= section does not have an equivalent remote m= section.
    var mid = getMidForMediaSection(section);
    var peerSection = mid && peerMidsToMediaSections.get(mid);
    if (!peerSection) {
        return section;
    }
    // Construct a Map of the peer Payload Types to their codec names.
    var peerPtToCodecs = createPtToCodecName(peerSection);
    // Construct a Map of the codec names to their Payload Types.
    var codecsToPts = createCodecMapForMediaSection(section);
    // Maintain a list of non-rtx Payload Types to retain.
    var pts = flatMap(Array.from(peerPtToCodecs), function (_a) {
        var _b = __read(_a, 2), peerPt = _b[0], peerCodec = _b[1];
        return peerCodec !== 'rtx' && !codecsToRemove.includes(peerCodec)
            ? getMatchingPayloadTypes(peerCodec, peerPt, codecsToPts, section, peerSection)
            : [];
    });
    // For each Payload Type that will be retained, retain their corresponding rtx
    // Payload Type if present.
    var rtxPts = codecsToPts.get('rtx') || [];
    // In "a=fmtp:<rtxPt> apt=<apt>", extract the codec PT <apt> associated with rtxPt.
    pts = pts.concat(rtxPts.filter(function (rtxPt) {
        var fmtpAttrs = getFmtpAttributesForPt(rtxPt, section);
        return fmtpAttrs && pts.includes(fmtpAttrs.apt);
    }));
    // Filter out the below mentioned attribute lines in the m= section that do not
    // belong to one of the Payload Types that are to be retained.
    // 1. "a=rtpmap:<pt> <codec>"
    // 2. "a=rtcp-fb:<pt> <attr>[ <attr>]*"
    // 3. "a=fmtp:<pt> <name>=<value>[;<name>=<value>]*"
    var lines = section.split('\r\n').filter(function (line) {
        var ptMatches = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(.+) .+$/);
        var pt = ptMatches && ptMatches[2];
        return !ptMatches || (pt && pts.includes(parseInt(pt, 10)));
    });
    // Filter the list of Payload Types in the first line of the m= section.
    var orderedPts = getPayloadTypesInMediaSection(section).filter(function (pt) { return pts.includes(pt); });
    return setPayloadTypesInMediaSection(orderedPts, lines.join('\r\n'));
}
/**
 * Filter local codecs based on the remote SDP.
 * @param {string} localSdp
 * @param {string} remoteSdp
 * @returns {string} - Updated local SDP
 */
function filterLocalCodecs(localSdp, remoteSdp) {
    var localMediaSections = getMediaSections(localSdp);
    var localSession = localSdp.split('\r\nm=')[0];
    var remoteMidsToMediaSections = createMidToMediaSectionMap(remoteSdp);
    return [localSession].concat(localMediaSections.map(function (localSection) {
        return filterCodecsInMediaSection(localSection, remoteMidsToMediaSections, []);
    })).join('\r\n');
}
/**
 * Return a new SDP string after reverting simulcast for non vp8 sections in remote sdp.
 * @param localSdp - simulcast enabled local sdp
 * @param localSdpWithoutSimulcast - local sdp before simulcast was set
 * @param remoteSdp - remote sdp
 * @param revertForAll - when true simulcast will be reverted for all codecs. when false it will be reverted
 *  only for non-vp8 codecs.
 * @return {string} Updated SDP string
 */
function revertSimulcast(localSdp, localSdpWithoutSimulcast, remoteSdp, revertForAll) {
    if (revertForAll === void 0) { revertForAll = false; }
    var remoteMidToMediaSections = createMidToMediaSectionMap(remoteSdp);
    var localMidToMediaSectionsWithoutSimulcast = createMidToMediaSectionMap(localSdpWithoutSimulcast);
    var mediaSections = getMediaSections(localSdp);
    var session = localSdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (section) {
        section = section.replace(/\r\n$/, '');
        if (!/^m=video/.test(section)) {
            return section;
        }
        var midMatches = section.match(/^a=mid:(.+)$/m);
        var mid = midMatches && midMatches[1];
        if (!mid) {
            return section;
        }
        var remoteSection = remoteMidToMediaSections.get(mid);
        var remotePtToCodecs = createPtToCodecName(remoteSection);
        var remotePayloadTypes = getPayloadTypesInMediaSection(remoteSection);
        var isVP8ThePreferredCodec = remotePayloadTypes.length && remotePtToCodecs.get(remotePayloadTypes[0]) === 'vp8';
        var shouldRevertSimulcast = revertForAll || !isVP8ThePreferredCodec;
        return shouldRevertSimulcast ? localMidToMediaSectionsWithoutSimulcast.get(mid).replace(/\r\n$/, '') : section;
    })).concat('').join('\r\n');
}
/**
 * Add or rewrite MSIDs for new m= sections in the given SDP with their corresponding
 * local MediaStreamTrack IDs. These can be different when previously removed MediaStreamTracks
 * are added back (or Track IDs may not be present in the SDPs at all once browsers implement
 * the latest WebRTC spec).
 * @param {string} sdp
 * @param {Map<string, Track.ID>} activeMidsToTrackIds
 * @param {Map<Track.Kind, Array<Track.ID>>} trackIdsByKind
 * @returns {string}
 */
function addOrRewriteNewTrackIds(sdp, activeMidsToTrackIds, trackIdsByKind) {
    // NOTE(mmalavalli): The m= sections for the new MediaStreamTracks are usually
    // present after the m= sections for the existing MediaStreamTracks, in order
    // of addition.
    var newMidsToTrackIds = Array.from(trackIdsByKind).reduce(function (midsToTrackIds, _a) {
        var _b = __read(_a, 2), kind = _b[0], trackIds = _b[1];
        var mediaSections = getMediaSections(sdp, kind, 'send(only|recv)');
        var newMids = mediaSections.map(getMidForMediaSection).filter(function (mid) { return !activeMidsToTrackIds.has(mid); });
        newMids.forEach(function (mid, i) { return midsToTrackIds.set(mid, trackIds[i]); });
        return midsToTrackIds;
    }, new Map());
    return addOrRewriteTrackIds(sdp, newMidsToTrackIds);
}
/**
 * Add or rewrite MSIDs in the given SDP with their corresponding local MediaStreamTrack IDs.
 * These IDs need not be the same (or Track IDs may not be present in the SDPs at all once
 * browsers implement the latest WebRTC spec).
 * @param {string} sdp
 * @param {Map<string, Track.ID>} midsToTrackIds
 * @returns {string}
 */
function addOrRewriteTrackIds(sdp, midsToTrackIds) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (mediaSection) {
        // Do nothing if the m= section represents neither audio nor video.
        if (!/^m=(audio|video)/.test(mediaSection)) {
            return mediaSection;
        }
        // This shouldn't happen, but in case there is no MID for the m= section, do nothing.
        var mid = getMidForMediaSection(mediaSection);
        if (!mid) {
            return mediaSection;
        }
        // In case there is no Track ID for the given MID in the map, do nothing.
        var trackId = midsToTrackIds.get(mid);
        if (!trackId) {
            return mediaSection;
        }
        // This shouldn't happen, but in case there is no a=msid: line, do nothing.
        var attributes = (mediaSection.match(/^a=msid:(.+)$/m) || [])[1];
        if (!attributes) {
            return mediaSection;
        }
        // If the a=msid: line contains the "appdata" field, then replace it with the Track ID,
        // otherwise append the Track ID.
        var _a = __read(attributes.split(' '), 2), msid = _a[0], trackIdToRewrite = _a[1];
        var msidRegex = new RegExp("msid:" + msid + (trackIdToRewrite ? " " + trackIdToRewrite : '') + "$", 'gm');
        return mediaSection.replace(msidRegex, "msid:" + msid + " " + trackId);
    })).join('\r\n');
}
/**
 * Removes specified ssrc attributes from given sdp.
 * @param {string} sdp
 * @param {Array<string>} ssrcAttributesToRemove
 * @returns {string}
 */
function removeSSRCAttributes(sdp, ssrcAttributesToRemove) {
    return sdp.split('\r\n').filter(function (line) {
        return !ssrcAttributesToRemove.find(function (srcAttribute) { return new RegExp('a=ssrc:.*' + srcAttribute + ':', 'g').test(line); });
    }).join('\r\n');
}
/**
 * Disable RTX in a given sdp.
 * @param {string} sdp
 * @returns {string} sdp without RTX
 */
function disableRtx(sdp) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (mediaSection) {
        // Do nothing if the m= section does not represent a video track.
        if (!/^m=video/.test(mediaSection)) {
            return mediaSection;
        }
        // Create a map of codecs to payload types.
        var codecsToPts = createCodecMapForMediaSection(mediaSection);
        // Get the RTX payload types.
        var rtxPts = codecsToPts.get('rtx');
        // Do nothing if there are no RTX payload types.
        if (!rtxPts) {
            return mediaSection;
        }
        // Remove the RTX payload types.
        var pts = new Set(getPayloadTypesInMediaSection(mediaSection));
        rtxPts.forEach(function (rtxPt) { return pts.delete(rtxPt); });
        // Get the RTX SSRC.
        var rtxSSRCMatches = mediaSection.match(/a=ssrc-group:FID [0-9]+ ([0-9]+)/);
        var rtxSSRC = rtxSSRCMatches && rtxSSRCMatches[1];
        // Remove the following lines associated with the RTX payload types:
        // 1. "a=fmtp:<rtxPt> apt=<pt>"
        // 2. "a=rtpmap:<rtxPt> rtx/..."
        // 3. "a=ssrc:<rtxSSRC> cname:..."
        // 4. "a=ssrc-group:FID <SSRC> <rtxSSRC>"
        var filterRegexes = [
            /^a=fmtp:.+ apt=.+$/,
            /^a=rtpmap:.+ rtx\/.+$/,
            /^a=ssrc-group:.+$/
        ].concat(rtxSSRC
            ? [new RegExp("^a=ssrc:" + rtxSSRC + " .+$")]
            : []);
        mediaSection = mediaSection.split('\r\n')
            .filter(function (line) { return filterRegexes.every(function (regex) { return !regex.test(line); }); })
            .join('\r\n');
        // Reconstruct the m= section without the RTX payload types.
        return setPayloadTypesInMediaSection(Array.from(pts), mediaSection);
    })).join('\r\n');
}
/**
 * Generate an a=fmtp: line from the given payload type and attributes.
 * @param {PT} pt
 * @param {*} fmtpAttrs
 * @returns {string}
 */
function generateFmtpLineFromPtAndAttributes(pt, fmtpAttrs) {
    var serializedFmtpAttrs = Object.entries(fmtpAttrs).map(function (_a) {
        var _b = __read(_a, 2), name = _b[0], value = _b[1];
        return name + "=" + value;
    }).join(';');
    return "a=fmtp:" + pt + " " + serializedFmtpAttrs;
}
/**
 * Enable DTX for opus in the m= sections for the given MIDs.`
 * @param {string} sdp
 * @param {Array<string>} [mids] - If not specified, enables opus DTX for all
 *   audio m= lines.
 * @returns {string}
 */
function enableDtxForOpus(sdp, mids) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    mids = mids || mediaSections
        .filter(function (section) { return /^m=audio/.test(section); })
        .map(getMidForMediaSection);
    return [session].concat(mediaSections.map(function (section) {
        // Do nothing if the m= section is not audio.
        if (!/^m=audio/.test(section)) {
            return section;
        }
        // Build a map codecs to payload types.
        var codecsToPts = createCodecMapForMediaSection(section);
        // Do nothing if a payload type for opus does not exist.
        var opusPt = codecsToPts.get('opus');
        if (!opusPt) {
            return section;
        }
        // If no fmtp attributes are found for opus, do nothing.
        var opusFmtpAttrs = getFmtpAttributesForPt(opusPt, section);
        if (!opusFmtpAttrs) {
            return section;
        }
        // Add usedtx=1 to the a=fmtp: line for opus.
        var origOpusFmtpLine = generateFmtpLineFromPtAndAttributes(opusPt, opusFmtpAttrs);
        var origOpusFmtpRegex = new RegExp(origOpusFmtpLine);
        // If the m= section's MID is in the list of MIDs, then enable dtx. Otherwise disable it.
        var mid = getMidForMediaSection(section);
        if (mids.includes(mid)) {
            opusFmtpAttrs.usedtx = 1;
        }
        else {
            delete opusFmtpAttrs.usedtx;
        }
        var opusFmtpLineWithDtx = generateFmtpLineFromPtAndAttributes(opusPt, opusFmtpAttrs);
        return section.replace(origOpusFmtpRegex, opusFmtpLineWithDtx);
    })).join('\r\n');
}
exports.addOrRewriteNewTrackIds = addOrRewriteNewTrackIds;
exports.addOrRewriteTrackIds = addOrRewriteTrackIds;
exports.createCodecMapForMediaSection = createCodecMapForMediaSection;
exports.createPtToCodecName = createPtToCodecName;
exports.disableRtx = disableRtx;
exports.enableDtxForOpus = enableDtxForOpus;
exports.filterLocalCodecs = filterLocalCodecs;
exports.getMediaSections = getMediaSections;
exports.removeSSRCAttributes = removeSSRCAttributes;
exports.revertSimulcast = revertSimulcast;
exports.setCodecPreferences = setCodecPreferences;
exports.setSimulcast = setSimulcast;
//# sourceMappingURL=index.js.map