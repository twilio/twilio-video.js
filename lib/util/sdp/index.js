'use strict';

const difference = require('../').difference;
const flatMap = require('../').flatMap;
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

// NOTE(mmalavalli): This value is derived from the IETF spec
// for JSEP, and it is used to convert a 'b=TIAS' value in bps
// to a 'b=AS' value in kbps.
// Spec: https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-21#section-5.9
const RTCP_BITRATE = 16000;

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
  return `\r\nb=${modifier}:${modifier === 'AS'
  ? Math.round((maxBitrate + RTCP_BITRATE) / 950)
  : maxBitrate}`;
}

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
  // the regex matches <port> and the PayloadTypes.
  const matches = mLine.match(/([0-9]+)/g);

  // This should not happen, but in case there are no PayloadTypes in
  // the m= line, return an empty array.
  if (!matches) {
    return [];
  }

  // Since only the PayloadTypes are needed, we discard the <port>.
  return matches.slice(1).map(match => parseInt(match, 10));
}

/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<Codec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
  preferredCodecs = preferredCodecs.map(codecName => codecName.toLowerCase());

  const preferredPayloadTypes = flatMap(preferredCodecs, codecName => codecMap.get(codecName) || []);

  const remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
  const remainingPayloadTypes = flatMap(remainingCodecs, codecName => codecMap.get(codecName));

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
  let bLine = createBLine(modifier, maxBitrate) || '';
  const bLinePattern = /\r\nb=(AS|TIAS):([0-9]+)/;
  const bLineMatched = section.match(bLinePattern);

  if (!bLineMatched) {
    return section.replace(/(\r\n)?$/, `${bLine}$1`);
  }

  const maxBitrateMatched = parseInt(bLineMatched[2], 10);
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
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(section => {
    // Bitrate parameters should not be applied to m=application sections
    // or to m=(audio|video) sections that do not receive media.
    if (!/^m=(audio|video)/.test(section) || !/a=(recvonly|sendrecv)/.test(section)) {
      return section;
    }
    const kind = section.match(/^m=(audio|video)/)[1];
    const maxBitrate = kind === 'audio' ? maxAudioBitrate : maxVideoBitrate;
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
    const preferredCodecs = kind === 'audio' ? preferredAudioCodecs : preferredVideoCodecs.map(codec => codec.codec);
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
 * @param {'planb' | 'unified'} sdpFormat
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes
 * @returns {string} Updated SDP string
 */
function setSimulcast(sdp, sdpFormat, trackIdsToAttributes) {
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
      ? setSimulcastInMediaSection(section, sdpFormat, trackIdsToAttributes)
      : section;
  })).concat('').join('\r\n');
}

/**
 * Rewrite MSIDs for new m= sections in the given Unified Plan SDP with their
 * corresponding local MediaStreamTrack IDs. These can be different when previously
 * removed MediaStreamTracks are added back.
 * @param {string} sdp
 * @param {Map<Track.Kind, Array<Track.ID>>} trackIdsByKind
 * @returns {string}
 */
function unifiedPlanRewriteNewTrackIds(sdp, trackIdsByKind) {
  return Array.from(trackIdsByKind).reduce((sdp, [kind, trackIds]) => {
    const sections = getMediaSections(sdp, kind);
    // NOTE(mmalavalli): The m= sections for the new MediaStreamTracks are usually
    // present after the m= sections for the existing MediaStreamTracks, in order
    // of addition.
    const sdpTrackIds = sections.slice(sections.length - trackIds.length).map(section => {
      return (section.match(/^a=msid:.+ (.+)$/m) || [])[1];
    });

    return sdpTrackIds.reduce((sdp, sdpTrackId, i) => {
      if (sdpTrackId) {
        const msidRegex = new RegExp(`msid:(.+) ${sdpTrackId}$`, 'gm');
        sdp = sdp.replace(msidRegex, `msid:$1 ${trackIds[i]}`);
      }
      return sdp;
    }, sdp);
  }, sdp);
}

/**
 * Rewrite MSIDs in the given Unified Plan SDP with their corresponding local
 * MediaStreamTrack IDs. These can be different when MediaStreamTracks are added
 * using RTCRtpSender.replaceTrack().
 * @param {string} sdp
 * @param {Map<string, Track.ID>} midsToTrackIds
 * @returns {string}
 */
function unifiedPlanRewriteTrackIds(sdp, midsToTrackIds) {
  return Array.from(midsToTrackIds).reduce((sdp, [mid, trackId]) => {
    const midRegex = new RegExp(`a=mid:${mid}`);
    const section = getMediaSections(sdp).find(section => midRegex.test(section));
    if (section) {
      const trackIdToRewrite = (section.match(/^a=msid:.+ (.+)$/m) || [])[1];
      if (trackIdToRewrite) {
        const msidRegex = new RegExp(`msid:(.+) ${trackIdToRewrite}$`, 'gm');
        sdp = sdp.replace(msidRegex, `msid:$1 ${trackId}`);
      }
    }
    return sdp;
  }, sdp);
}

/**
 * Codec Payload Type.
 * @typedef {number} PayloadType
 */

exports.createCodecMapForMediaSection = createCodecMapForMediaSection;
exports.createPtToCodecName = createPtToCodecName;
exports.getMediaSections = getMediaSections;
exports.setBitrateParameters = setBitrateParameters;
exports.setCodecPreferences = setCodecPreferences;
exports.setSimulcast = setSimulcast;
exports.unifiedPlanRewriteNewTrackIds = unifiedPlanRewriteNewTrackIds;
exports.unifiedPlanRewriteTrackIds = unifiedPlanRewriteTrackIds;
