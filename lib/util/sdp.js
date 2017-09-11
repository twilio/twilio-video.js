'use strict';

var difference = require('./').difference;
var flatMap = require('./').flatMap;

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
  return '\r\nb=' + modifier + ':' + (modifier === 'AS'
    ? Math.round((maxBitrate + RTCP_BITRATE) / 950)
    : maxBitrate);
}

/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<AudioCodec|VideoCodec, Array<PayloadType>>}
 */
function createCodecMapForMediaSection(section) {
  var payloadTypes = getPayloadTypesInMediaSection(section);
  return payloadTypes.reduce(function(codecMap, payloadType) {
    var rtpmapPattern = new RegExp('a=rtpmap:' + payloadType + ' ([^/]+)');
    var matches = section.match(rtpmapPattern);

    // This should not happen, but in case there is no rtpmap entry
    // for a given Codec Name, then return the existing Codec Map.
    if (!matches) {
      return codecMap;
    }

    var codecName = matches[1].toLowerCase();
    var types = codecMap.get(codecName) || [];
    return codecMap.set(codecName, types.concat(payloadType));
  }, new Map());
}

/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
  return sdp.split('\r\nm=').slice(1).map(function(mediaSection) {
    return 'm=' + mediaSection;
  }).filter(function(mediaSection) {
    var kindPattern = new RegExp('m=' + (kind || '.*'), 'gm');
    var directionPattern = new RegExp('a=' + (direction || '.*'), 'gm');
    return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
  });
}

/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PayloadType>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
  var mLine = section.split('\r\n')[0];

  // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
  // the regex matches <port> and the PayloadTypes.
  var matches = mLine.match(/([0-9]+)/g);

  // This should not happen, but in case there are no PayloadTypes in
  // the m= line, return an empty array.
  if (!matches) {
    return [];
  }

  // Since only the PayloadTypes are needed, we discard the <port>.
  return matches.slice(1).map(function(match) {
    return parseInt(match, 10);
  });
}

/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<AudioCodec|VideoCodec, Array<PayloadType>>} codecMap - Codec Map
 * @param {Array<AudioCodec|VideoCodec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PayloadType>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
  preferredCodecs = preferredCodecs.map(function(codecName) {
    return codecName.toLowerCase();
  });

  var preferredPayloadTypes = flatMap(preferredCodecs, function(codecName) {
    return codecMap.get(codecName) || [];
  });

  var remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
  var remainingPayloadTypes = flatMap(remainingCodecs, function(codecName) {
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
  return [session].concat(mediaSections.map(function(section) {
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
 * @param {Array<PayloadType>} payloadTypes - Payload Types
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
 * @param {Array<VideoCodec>} preferredVideoCodecs - If empty, the existing order
 *   of video codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredAudioCodecs, preferredVideoCodecs) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(function(section) {
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
 * Codec Payload Type.
 * @typedef {number} PayloadType
 */

exports.getMediaSections = getMediaSections;
exports.setBitrateParameters = setBitrateParameters;
exports.setCodecPreferences = setCodecPreferences;
