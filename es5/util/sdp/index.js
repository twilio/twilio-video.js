'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var difference = require('../').difference;
var flatMap = require('../').flatMap;
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

// NOTE(mmalavalli): This value is derived from the IETF spec
// for JSEP, and it is used to convert a 'b=TIAS' value in bps
// to a 'b=AS' value in kbps.
// Spec: https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-21#section-5.9
var RTCP_BITRATE = 16000;

/**
 * Construct a b= line string for the given max bitrate in bps. If the modifier
 * is 'AS', then the max bitrate will be converted to kbps using the formula
 * specified in the IETF spec for JSEP mentioned above.
 * @param {string} modifier - 'AS' | 'TIAS'
 * @param {?number} maxBitrate - Max outgoing bitrate (bps)
 * @returns {?string} - If "maxBitrate" is null, then returns null;
 *   otherwise return the constructed b= line string
 */
function createBLine(modifier, maxBitrate) {
  if (!maxBitrate) {
    return null;
  }
  return '\r\nb=' + modifier + ':' + (modifier === 'AS' ? Math.round((maxBitrate + RTCP_BITRATE) / 950) : maxBitrate);
}

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
    var rtpmapPattern = new RegExp('a=rtpmap:' + pt + ' ([^/]+)');
    var matches = mediaSection.match(rtpmapPattern);
    var codecName = matches ? matches[1].toLowerCase() : ptToFixedBitrateAudioCodecName[pt] ? ptToFixedBitrateAudioCodecName[pt].toLowerCase() : '';
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
  var fmtpRegex = new RegExp('^a=fmtp:' + pt + ' (.+)$', 'm');
  var matches = mediaSection.match(fmtpRegex);
  return matches && matches[1].split(';').reduce(function (attrs, nvPair) {
    var _nvPair$split = nvPair.split('='),
        _nvPair$split2 = _slicedToArray(_nvPair$split, 2),
        name = _nvPair$split2[0],
        value = _nvPair$split2[1];

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
  return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) {
    return 'm=' + mediaSection;
  }).filter(function (mediaSection) {
    var kindPattern = new RegExp('m=' + (kind || '.*'), 'gm');
    var directionPattern = new RegExp('a=' + (direction || '.*'), 'gm');
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
  return matches.slice(1).map(function (match) {
    return parseInt(match, 10);
  });
}

/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<Codec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
  preferredCodecs = preferredCodecs.map(function (codecName) {
    return codecName.toLowerCase();
  });

  var preferredPayloadTypes = flatMap(preferredCodecs, function (codecName) {
    return codecMap.get(codecName) || [];
  });

  var remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
  var remainingPayloadTypes = flatMap(remainingCodecs, function (codecName) {
    return codecMap.get(codecName);
  });

  return preferredPayloadTypes.concat(remainingPayloadTypes);
}

/**
 * Set the specified max bitrate in the given m= section.
 * @param {string} modifier - 'AS' | 'TIAS'
 * @param {?number} maxBitrate - Max outgoing bitrate (bps)
 * @param {string} section - m= section string
 * @returns {string} The updated m= section
 */
function setBitrateInMediaSection(modifier, maxBitrate, section) {
  var bLine = createBLine(modifier, maxBitrate) || '';
  var bLinePattern = /\r\nb=(AS|TIAS):([0-9]+)/;
  var bLineMatched = section.match(bLinePattern);

  if (!bLineMatched) {
    return section.replace(/(\r\n)?$/, bLine + '$1');
  }

  var maxBitrateMatched = parseInt(bLineMatched[2], 10);
  maxBitrate = maxBitrate || Infinity;
  bLine = createBLine(modifier, Math.min(maxBitrateMatched, maxBitrate));
  return section.replace(bLinePattern, bLine);
}

/**
 * Set maximum bitrates to the media sections in a given sdp.
 * @param {string} sdp - sdp string
 * @param {string} modifier - 'AS' | 'TIAS"
 * @param {?number} maxAudioBitrate - Max outgoing audio bitrate (bps), null
 *   if no limit is to be applied
 * @param {?number} maxVideoBitrate - Max outgoing video bitrate (bps), null
 *   if no limit is to be applied
 * @returns {string} - The updated sdp string
 */
function setBitrateParameters(sdp, modifier, maxAudioBitrate, maxVideoBitrate) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(function (section) {
    // Bitrate parameters should not be applied to m=application sections
    // or to m=(audio|video) sections that do not receive media.
    if (!/^m=(audio|video)/.test(section) || !/a=(recvonly|sendrecv)/.test(section)) {
      return section;
    }
    var kind = section.match(/^m=(audio|video)/)[1];
    var maxBitrate = kind === 'audio' ? maxAudioBitrate : maxVideoBitrate;
    return setBitrateInMediaSection(modifier, maxBitrate, section);
  })).join('\r\n');
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
    var preferredCodecs = kind === 'audio' ? preferredAudioCodecs : preferredVideoCodecs.map(function (codec) {
      return codec.codec;
    });
    var payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
    var newSection = setPayloadTypesInMediaSection(payloadTypes, section);

    var pcmaPayloadTypes = codecMap.get('pcma') || [];
    var pcmuPayloadTypes = codecMap.get('pcmu') || [];
    var fixedBitratePayloadTypes = kind === 'audio' ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes)) : new Set();

    return fixedBitratePayloadTypes.has(payloadTypes[0]) ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '') : newSection;
  })).join('\r\n');
}

/**
 * Return a new SDP string with simulcast settings.
 * @param {string} sdp
 * @param {'planb' | 'unified'} sdpFormat
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes
 * @returns {string} Updated SDP string
 */
function setSimulcast(sdp, sdpFormat, trackIdsToAttributes) {
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

    var hasVP8PayloadType = payloadTypes.some(function (payloadType) {
      return vp8PayloadTypes.has(payloadType);
    });
    return hasVP8PayloadType ? setSimulcastInMediaSection(section, sdpFormat, trackIdsToAttributes) : section;
  })).concat('').join('\r\n');
}

/**
 * Get the matching Payload Types in a unified plan local m= section for a particular remote codec.
 * @param {Codec} remoteCodec
 * @param {PT} remotePt
 * @param {Map<Codec, PT>} localCodecsToPts
 * @param {string} localSection
 * @param {string} remoteSection
 * @returns {Array<PT>}
 */
function unifiedPlanGetMatchingLocalPayloadTypes(remoteCodec, remotePt, localCodecsToPts, localSection, remoteSection) {
  // If there is at most one local Payload Type that matches the remote codec, retain it.
  var matchingLocalPts = localCodecsToPts.get(remoteCodec) || [];
  if (matchingLocalPts.length <= 1) {
    return matchingLocalPts;
  }

  // If there are no fmtp attributes for the codec in the remote m= section,
  // then we cannot get a match in the local m= section. In that case, retain
  // all matching local Payload Types.
  var remoteFmtpAttrs = getFmtpAttributesForPt(remotePt, remoteSection);
  if (!remoteFmtpAttrs) {
    return matchingLocalPts;
  }

  // Among the matched local Payload Types, find the one that matches the remote
  // fmtp attributes.
  var matchinglocalPt = matchingLocalPts.find(function (localPt) {
    var localFmtpAttrs = getFmtpAttributesForPt(localPt, localSection);
    return localFmtpAttrs && Object.keys(remoteFmtpAttrs).every(function (attr) {
      return remoteFmtpAttrs[attr] === localFmtpAttrs[attr];
    });
  });

  // If none of the matched local Payload Types also have matching fmtp attributes,
  // then retain all of them, otherwise retain only the local Payload Type that
  // matches the remote fmtp attributes.
  return typeof matchinglocalPt === 'number' ? [matchinglocalPt] : matchingLocalPts;
}

/**
 * Add or rewrite MSIDs for new m= sections in the given Unified Plan SDP with their
 * corresponding local MediaStreamTrack IDs. These can be different when previously
 * removed MediaStreamTracks are added back (or Track IDs may not be present in the
 * SDPs at all once browsers implement the latest WebRTC spec).
 * @param {string} sdp
 * @param {Map<string, Track.ID>} activeMidsToTrackIds
 * @param {Map<Track.Kind, Array<Track.ID>>} trackIdsByKind
 * @returns {string}
 */
function unifiedPlanAddOrRewriteNewTrackIds(sdp, activeMidsToTrackIds, trackIdsByKind) {
  var newMidsToTrackIds = Array.from(trackIdsByKind).reduce(function (midsToTrackIds, _ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        kind = _ref2[0],
        trackIds = _ref2[1];

    var sendMids = getMediaSections(sdp, kind, 'send(only|recv)').map(getMidForMediaSection);
    var newMids = sendMids.filter(function (mid) {
      return !activeMidsToTrackIds.has(mid);
    });
    newMids.forEach(function (mid, i) {
      return midsToTrackIds.set(mid, trackIds[i]);
    });
    return midsToTrackIds;
  }, new Map());
  return unifiedPlanAddOrRewriteTrackIds(sdp, newMidsToTrackIds);
}

/**
 * Add or rewrite MSIDs in the given Unified Plan SDP with their corresponding local
 * MediaStreamTrack IDs. These IDs need not be the same (or Track IDs may not be
 * present in the SDPs at all once browsers implement the latest WebRTC spec).
 * @param {string} sdp
 * @param {Map<string, string>} midsToTrackIds
 * @returns {string}
 */
function unifiedPlanAddOrRewriteTrackIds(sdp, midsToTrackIds) {
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

    var _attributes$split = attributes.split(' '),
        _attributes$split2 = _slicedToArray(_attributes$split, 2),
        msid = _attributes$split2[0],
        trackIdToRewrite = _attributes$split2[1];

    var msidRegex = new RegExp('msid:' + msid + (trackIdToRewrite ? ' ' + trackIdToRewrite : '') + '$', 'gm');
    return mediaSection.replace(msidRegex, 'msid:' + msid + ' ' + trackId);
  })).join('\r\n');
}

/**
* Filter codecs in a local unified plan m= section based on its equivalent remote m= section.
* @param {string} localSection
* @param {Map<string, string>} remoteMidsToMediaSections
* @returns {string}
*/
function unifiedPlanFilterCodecsInLocalMediaSection(localSection, remoteMidsToMediaSections) {
  // Do nothing if the local m= section represents neither audio nor video.
  if (!/^m=(audio|video)/.test(localSection)) {
    return localSection;
  }

  // Do nothing if the local m= section does not have an equivalent remote m= section.
  var localMid = getMidForMediaSection(localSection);
  var remoteSection = localMid && remoteMidsToMediaSections.get(localMid);
  if (!remoteSection) {
    return localSection;
  }

  // Construct a Map of the remote Payload Types to their codec names.
  var remotePtToCodecs = createPtToCodecName(remoteSection);
  // Construct a Map of the local codec names to their Payload Types.
  var localCodecsToPts = createCodecMapForMediaSection(localSection);
  // Maintain a list of local non-rtx Payload Types to retain.
  var localPts = flatMap(Array.from(remotePtToCodecs), function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        remotePt = _ref4[0],
        remoteCodec = _ref4[1];

    return remoteCodec !== 'rtx' ? unifiedPlanGetMatchingLocalPayloadTypes(remoteCodec, remotePt, localCodecsToPts, localSection, remoteSection) : [];
  });

  // For each local Payload Type that will be retained, retain their
  // corresponding rtx Payload Type if present.
  var localRtxPts = localCodecsToPts.get('rtx') || [];
  // In "a=fmtp:<rtxPt> apt=<apt>", extract the codec PT <apt> associated with rtxPt.
  localPts = localPts.concat(localRtxPts.filter(function (rtxPt) {
    var fmtpAttrs = getFmtpAttributesForPt(rtxPt, localSection);
    return fmtpAttrs && localPts.includes(fmtpAttrs.apt);
  }));

  // Filter out the below mentioned attribute lines in the local m= section that
  // do not belong to one of the local Payload Types that are to be retained.
  // 1. "a=rtpmap:<pt> <codec>"
  // 2. "a=rtcp-fb:<pt> <attr>[ <attr>]*"
  // 3. "a=fmtp:<pt> <name>=<value>[;<name>=<value>]*"
  var lines = localSection.split('\r\n').filter(function (line) {
    var ptMatches = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(.+) .+$/);
    var pt = ptMatches && ptMatches[2];
    return !ptMatches || pt && localPts.includes(parseInt(pt, 10));
  });

  // Filter the list of Payload Types in the first line of the m= section.
  var orderedLocalPts = getPayloadTypesInMediaSection(localSection).filter(function (pt) {
    return localPts.includes(pt);
  });
  return setPayloadTypesInMediaSection(orderedLocalPts, lines.join('\r\n'));
}

/**
 * Filter local codecs based on the remote unified plan SDP.
 * @param {string} localSdp
 * @param {string} remoteSdp
 * @returns {string} - Updated local SDP
 */
function unifiedPlanFilterLocalCodecs(localSdp, remoteSdp) {
  var localMediaSections = getMediaSections(localSdp);
  var localSession = localSdp.split('\r\nm=')[0];
  var remoteMidsToMediaSections = createMidToMediaSectionMap(remoteSdp);
  return [localSession].concat(localMediaSections.map(function (localSection) {
    return unifiedPlanFilterCodecsInLocalMediaSection(localSection, remoteMidsToMediaSections);
  })).join('\r\n');
}

/**
 *  Codec Payload Type.
 * @typedef {number} PayloadType
 */

exports.createCodecMapForMediaSection = createCodecMapForMediaSection;
exports.createPtToCodecName = createPtToCodecName;
exports.getMediaSections = getMediaSections;
exports.setBitrateParameters = setBitrateParameters;
exports.setCodecPreferences = setCodecPreferences;
exports.setSimulcast = setSimulcast;
exports.unifiedPlanAddOrRewriteNewTrackIds = unifiedPlanAddOrRewriteNewTrackIds;
exports.unifiedPlanAddOrRewriteTrackIds = unifiedPlanAddOrRewriteTrackIds;
exports.unifiedPlanFilterLocalCodecs = unifiedPlanFilterLocalCodecs;