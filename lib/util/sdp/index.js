'use strict';

const { difference, flatMap } = require('../');
const setSimulcastInMediaSection = require('./simulcast');

const ptToFixedBitrateAudioCodecName = {
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
  return Array.from(createPtToCodecName(section)).reduce((codecMap, pair) => {
    const pt = pair[0];
    const codecName = pair[1];
    const pts = codecMap.get(codecName) || [];
    return codecMap.set(codecName, pts.concat(pt));
  }, new Map());
}

/**
 * Create a Map of MIDs to m= sections for the given SDP.
 * @param {string} sdp
 * @returns {Map<string, string>}
 */
function createMidToMediaSectionMap(sdp) {
  return getMediaSections(sdp).reduce((midsToMediaSections, mediaSection) => {
    const mid = getMidForMediaSection(mediaSection);
    return mid ? midsToMediaSections.set(mid, mediaSection) : midsToMediaSections;
  }, new Map());
}

/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
  return getPayloadTypesInMediaSection(mediaSection).reduce((ptToCodecName, pt) => {
    const rtpmapPattern = new RegExp(`a=rtpmap:${pt} ([^/]+)`);
    const matches = mediaSection.match(rtpmapPattern);
    const codecName = matches
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
  const fmtpRegex = new RegExp(`^a=fmtp:${pt} (.+)$`, 'm');
  const matches = mediaSection.match(fmtpRegex);
  return matches && matches[1].split(';').reduce((attrs, nvPair) => {
    const [name, value] = nvPair.split('=');
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
  const midMatches = mediaSection.match(/^a=mid:(.+)$/m);
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
  return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(mediaSection => `m=${mediaSection}`).filter(mediaSection => {
    const kindPattern = new RegExp(`m=${kind || '.*'}`, 'gm');
    const directionPattern = new RegExp(`a=${direction || '.*'}`, 'gm');
    return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
  });
}

/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PT>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
  const mLine = section.split('\r\n')[0];

  // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
  // the regex matches <port> and the Payload Types.
  const matches = mLine.match(/([0-9]+)/g);

  // This should not happen, but in case there are no Payload Types in
  // the m= line, return an empty array.
  if (!matches) {
    return [];
  }

  // Since only the Payload Types are needed, we discard the <port>.
  return matches.slice(1).map(match => parseInt(match, 10));
}

/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<AudioCodecSettings|VideoCodecSettings>} preferredCodecs - Preferred Codecs
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
  preferredCodecs = preferredCodecs.map(({ codec }) => codec.toLowerCase());
  const preferredPayloadTypes = flatMap(preferredCodecs, codecName => codecMap.get(codecName) || []);
  const remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
  const remainingPayloadTypes = flatMap(remainingCodecs, codecName => codecMap.get(codecName));
  return preferredPayloadTypes.concat(remainingPayloadTypes);
}

/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
  const lines = section.split('\r\n');
  let mLine = lines[0];
  const otherLines = lines.slice(1);
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
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(section => {
    // Codec preferences should not be applied to m=application sections.
    if (!/^m=(audio|video)/.test(section)) {
      return section;
    }
    const kind = section.match(/^m=(audio|video)/)[1];
    const codecMap = createCodecMapForMediaSection(section);
    const preferredCodecs = kind === 'audio' ? preferredAudioCodecs : preferredVideoCodecs;
    const payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
    const newSection = setPayloadTypesInMediaSection(payloadTypes, section);

    const pcmaPayloadTypes = codecMap.get('pcma') || [];
    const pcmuPayloadTypes = codecMap.get('pcmu') || [];
    const fixedBitratePayloadTypes = kind === 'audio'
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
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(section => {
    section = section.replace(/\r\n$/, '');
    if (!/^m=video/.test(section)) {
      return section;
    }
    const codecMap = createCodecMapForMediaSection(section);
    const payloadTypes = getPayloadTypesInMediaSection(section);
    const vp8PayloadTypes = new Set(codecMap.get('vp8') || []);

    const hasVP8PayloadType = payloadTypes.some(payloadType => vp8PayloadTypes.has(payloadType));
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
  const matchingPts = codecsToPts.get(peerCodec) || [];
  if (matchingPts.length <= 1) {
    return matchingPts;
  }

  // If there are no fmtp attributes for the codec in the peer m= section, then we
  // cannot get a match in the  m= section. In that case, retain all matching Payload
  // Types.
  const peerFmtpAttrs = getFmtpAttributesForPt(peerPt, peerSection);
  if (!peerFmtpAttrs) {
    return matchingPts;
  }

  // Among the matched local Payload Types, find the one that matches the remote
  // fmtp attributes.
  const matchingPt = matchingPts.find(pt => {
    const fmtpAttrs = getFmtpAttributesForPt(pt, section);
    return fmtpAttrs && Object.keys(peerFmtpAttrs).every(attr => {
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
  const mid = getMidForMediaSection(section);
  const peerSection = mid && peerMidsToMediaSections.get(mid);
  if (!peerSection) {
    return section;
  }

  // Construct a Map of the peer Payload Types to their codec names.
  const peerPtToCodecs = createPtToCodecName(peerSection);
  // Construct a Map of the codec names to their Payload Types.
  const codecsToPts = createCodecMapForMediaSection(section);
  // Maintain a list of non-rtx Payload Types to retain.
  let pts = flatMap(Array.from(peerPtToCodecs), ([peerPt, peerCodec]) =>
    peerCodec !== 'rtx' && !codecsToRemove.includes(peerCodec)
      ? getMatchingPayloadTypes(
        peerCodec,
        peerPt,
        codecsToPts,
        section,
        peerSection)
      : []);

  // For each Payload Type that will be retained, retain their corresponding rtx
  // Payload Type if present.
  const rtxPts = codecsToPts.get('rtx') || [];
  // In "a=fmtp:<rtxPt> apt=<apt>", extract the codec PT <apt> associated with rtxPt.
  pts = pts.concat(rtxPts.filter(rtxPt => {
    const fmtpAttrs = getFmtpAttributesForPt(rtxPt, section);
    return fmtpAttrs && pts.includes(fmtpAttrs.apt);
  }));

  // Filter out the below mentioned attribute lines in the m= section that do not
  // belong to one of the Payload Types that are to be retained.
  // 1. "a=rtpmap:<pt> <codec>"
  // 2. "a=rtcp-fb:<pt> <attr>[ <attr>]*"
  // 3. "a=fmtp:<pt> <name>=<value>[;<name>=<value>]*"
  const lines = section.split('\r\n').filter(line => {
    const ptMatches = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(.+) .+$/);
    const pt = ptMatches && ptMatches[2];
    return !ptMatches || (pt && pts.includes(parseInt(pt, 10)));
  });

  // Filter the list of Payload Types in the first line of the m= section.
  const orderedPts = getPayloadTypesInMediaSection(section).filter(pt => pts.includes(pt));
  return setPayloadTypesInMediaSection(orderedPts, lines.join('\r\n'));
}

/**
 * Filter local codecs based on the remote SDP.
 * @param {string} localSdp
 * @param {string} remoteSdp
 * @returns {string} - Updated local SDP
 */
function filterLocalCodecs(localSdp, remoteSdp) {
  const localMediaSections = getMediaSections(localSdp);
  const localSession = localSdp.split('\r\nm=')[0];
  const remoteMidsToMediaSections = createMidToMediaSectionMap(remoteSdp);
  return [localSession].concat(localMediaSections.map(localSection => {
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
function revertSimulcast(localSdp, localSdpWithoutSimulcast, remoteSdp, revertForAll = false) {
  const remoteMidToMediaSections = createMidToMediaSectionMap(remoteSdp);
  const localMidToMediaSectionsWithoutSimulcast = createMidToMediaSectionMap(localSdpWithoutSimulcast);
  const mediaSections = getMediaSections(localSdp);
  const session = localSdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(section => {
    section = section.replace(/\r\n$/, '');
    if (!/^m=video/.test(section)) {
      return section;
    }
    const midMatches = section.match(/^a=mid:(.+)$/m);
    const mid = midMatches && midMatches[1];
    if (!mid) {
      return section;
    }

    const remoteSection = remoteMidToMediaSections.get(mid);
    const remotePtToCodecs = createPtToCodecName(remoteSection);
    const remotePayloadTypes = getPayloadTypesInMediaSection(remoteSection);

    const isVP8ThePreferredCodec = remotePayloadTypes.length && remotePtToCodecs.get(remotePayloadTypes[0]) === 'vp8';
    const shouldRevertSimulcast = revertForAll || !isVP8ThePreferredCodec;
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
  const newMidsToTrackIds = Array.from(trackIdsByKind).reduce((midsToTrackIds, [kind, trackIds]) => {
    const mediaSections = getMediaSections(sdp, kind, 'send(only|recv)');
    const newMids = mediaSections.map(getMidForMediaSection).filter(mid => !activeMidsToTrackIds.has(mid));
    newMids.forEach((mid, i) => midsToTrackIds.set(mid, trackIds[i]));
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
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(mediaSection => {
    // Do nothing if the m= section represents neither audio nor video.
    if (!/^m=(audio|video)/.test(mediaSection)) {
      return mediaSection;
    }
    // This shouldn't happen, but in case there is no MID for the m= section, do nothing.
    const mid = getMidForMediaSection(mediaSection);
    if (!mid) {
      return mediaSection;
    }
    // In case there is no Track ID for the given MID in the map, do nothing.
    const trackId = midsToTrackIds.get(mid);
    if (!trackId) {
      return mediaSection;
    }
    // This shouldn't happen, but in case there is no a=msid: line, do nothing.
    const attributes = (mediaSection.match(/^a=msid:(.+)$/m) || [])[1];
    if (!attributes) {
      return mediaSection;
    }
    // If the a=msid: line contains the "appdata" field, then replace it with the Track ID,
    // otherwise append the Track ID.
    const [msid, trackIdToRewrite] = attributes.split(' ');
    const msidRegex = new RegExp(`msid:${msid}${trackIdToRewrite ? ` ${trackIdToRewrite}` : ''}$`, 'gm');
    return mediaSection.replace(msidRegex, `msid:${msid} ${trackId}`);
  })).join('\r\n');
}

/**
 * Removes specified ssrc attributes from given sdp.
 * @param {string} sdp
 * @param {Array<string>} ssrcAttributesToRemove
 * @returns {string}
 */
function removeSSRCAttributes(sdp, ssrcAttributesToRemove) {
  return sdp.split('\r\n').filter(line =>
    !ssrcAttributesToRemove.find(srcAttribute => new RegExp('a=ssrc:.*' + srcAttribute + ':', 'g').test(line))
  ).join('\r\n');
}

/**
 * Disable RTX in a given sdp.
 * @param {string} sdp
 * @returns {string} sdp without RTX
 */
function disableRtx(sdp) {
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(mediaSection => {
    // Do nothing if the m= section does not represent a video track.
    if (!/^m=video/.test(mediaSection)) {
      return mediaSection;
    }

    // Create a map of codecs to payload types.
    const codecsToPts = createCodecMapForMediaSection(mediaSection);
    // Get the RTX payload types.
    const rtxPts = codecsToPts.get('rtx');

    // Do nothing if there are no RTX payload types.
    if (!rtxPts) {
      return mediaSection;
    }

    // Remove the RTX payload types.
    const pts = new Set(getPayloadTypesInMediaSection(mediaSection));
    rtxPts.forEach(rtxPt => pts.delete(rtxPt));

    // Get the RTX SSRC.
    const rtxSSRCMatches = mediaSection.match(/a=ssrc-group:FID [0-9]+ ([0-9]+)/);
    const rtxSSRC = rtxSSRCMatches && rtxSSRCMatches[1];

    // Remove the following lines associated with the RTX payload types:
    // 1. "a=fmtp:<rtxPt> apt=<pt>"
    // 2. "a=rtpmap:<rtxPt> rtx/..."
    // 3. "a=ssrc:<rtxSSRC> cname:..."
    // 4. "a=ssrc-group:FID <SSRC> <rtxSSRC>"
    const filterRegexes = [
      /^a=fmtp:.+ apt=.+$/,
      /^a=rtpmap:.+ rtx\/.+$/,
      /^a=ssrc-group:.+$/
    ].concat(rtxSSRC
      ? [new RegExp(`^a=ssrc:${rtxSSRC} .+$`)]
      : []);

    mediaSection = mediaSection.split('\r\n')
      .filter(line => filterRegexes.every(regex => !regex.test(line)))
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
  const serializedFmtpAttrs = Object.entries(fmtpAttrs).map(([name, value]) => {
    return `${name}=${value}`;
  }).join(';');
  return `a=fmtp:${pt} ${serializedFmtpAttrs}`;
}

/**
 * Enable DTX for opus in the m= sections for the given MIDs.`
 * @param {string} sdp
 * @param {Array<string>} [mids] - If not specified, enables opus DTX for all
 *   audio m= lines.
 * @returns {string}
 */
function enableDtxForOpus(sdp, mids) {
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];

  mids = mids || mediaSections
    .filter(section => /^m=audio/.test(section))
    .map(getMidForMediaSection);

  return [session].concat(mediaSections.map(section => {
    // Do nothing if the m= section is not audio.
    if (!/^m=audio/.test(section)) {
      return section;
    }

    // Build a map codecs to payload types.
    const codecsToPts = createCodecMapForMediaSection(section);

    // Do nothing if a payload type for opus does not exist.
    const opusPt = codecsToPts.get('opus');
    if (!opusPt) {
      return section;
    }

    // If no fmtp attributes are found for opus, do nothing.
    const opusFmtpAttrs = getFmtpAttributesForPt(opusPt, section);
    if (!opusFmtpAttrs) {
      return section;
    }

    // Add usedtx=1 to the a=fmtp: line for opus.
    const origOpusFmtpLine = generateFmtpLineFromPtAndAttributes(opusPt, opusFmtpAttrs);
    const origOpusFmtpRegex = new RegExp(origOpusFmtpLine);

    // If the m= section's MID is in the list of MIDs, then enable dtx. Otherwise disable it.
    const mid = getMidForMediaSection(section);
    if (mids.includes(mid)) {
      opusFmtpAttrs.usedtx = 1;
    } else {
      delete opusFmtpAttrs.usedtx;
    }

    const opusFmtpLineWithDtx = generateFmtpLineFromPtAndAttributes(opusPt, opusFmtpAttrs);
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
