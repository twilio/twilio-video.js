'use strict';

var RTCSessionDescription = require('@twilio/webrtc').RTCSessionDescription;

var createPtToCodecName = require('./').createPtToCodecName;
var getMediaSections = require('./').getMediaSections;

/**
 * An RTX payload type
 * @typedef {PT} RtxPT
 */

/**
 * A non-RTX payload type
 * @typedef {PT} NonRtxPT
 */

/**
 * A Set with at least one element
 * @typedef {Set} NonEmptySet
 */

/**
 * Apply the workaround for Issue 8329 to an RTCSessionDescriptionInit.
 * @param {RTCSessionDescriptionInit} description
 * @returns {RTCSessionDescription} newDescription
 */
function workaround(description) {
  var descriptionInit = { type: description.type };
  if (description.type !== 'rollback') {
    descriptionInit.sdp = sdpWorkaround(description.sdp);
  }
  return new RTCSessionDescription(descriptionInit);
}

/**
 * @param {string} sdp
 * @returns {string} newSdp
 */
function sdpWorkaround(sdp) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session]
    .concat(mediaSections.map(mediaSectionWorkaround))
    .join('\r\n');
}

/**
 * @param {string} mediaSection
 * @returns {string} newMediaSection
 */
function mediaSectionWorkaround(mediaSection) {
  var ptToCodecName = createPtToCodecName(mediaSection);
  var codecNameToPts = createCodecNameToPts(ptToCodecName);
  var rtxPts = codecNameToPts.get('rtx') || new Set();

  var invalidRtxPts = new Set();
  var rtxPtToAssociatedPt = createRtxPtToAssociatedPt(
    mediaSection, ptToCodecName, rtxPts, invalidRtxPts);
  var associatedPtToRtxPt = createAssociatedPtToRtxPt(
    rtxPtToAssociatedPt, invalidRtxPts);

  var unassociatedRtxPts = Array.from(invalidRtxPts);

  // NOTE(mroberts): We normalize to lowercase.
  var knownCodecNames = ['h264', 'vp8', 'vp9'];
  var unassociatedPts = knownCodecNames.reduce(function(unassociatedPts, codecName) {
    var pts = codecNameToPts.get(codecName) || new Set();
    return Array.from(pts).reduce(function(unassociatedPts, pt) {
      return associatedPtToRtxPt.has(pt)
        ? unassociatedPts
        : unassociatedPts.add(pt);
    }, unassociatedPts);
  }, new Set());

  unassociatedPts.forEach(function(pt) {
    if (unassociatedRtxPts.length) {
      var rtxPt = unassociatedRtxPts.shift();
      mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
      mediaSection = addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt);
    }
  });

  unassociatedRtxPts.forEach(function(rtxPt) {
    mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
    mediaSection = deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt);
  });

  return mediaSection;
}

/**
 * @param {Map<PT, Codec>} ptToCodecName
 * @returns {Map<string, NonEmptySet<PT>>} codecNameToPts
 */
function createCodecNameToPts(ptToCodecName) {
  var codecNameToPts = new Map();
  ptToCodecName.forEach(function(codecName, pt) {
    var pts = codecNameToPts.get(codecName) || new Set();
    return codecNameToPts.set(codecName, pts.add(pt));
  });
  return codecNameToPts;
}

/**
 * @param {string} mediaSection
 * @param {Map<PT, Codec>} ptToCodecName
 * @param {Set<RtxPT>} rtxPts
 * @param {Set<RtxPT>} invalidRtxPts
 * @returns {Map<RtxPT, NonRtxPT>} rtxPtToAssociatedPt
 */
function createRtxPtToAssociatedPt(mediaSection, ptToCodecName, rtxPts, invalidRtxPts) {
  return Array.from(rtxPts).reduce(function(rtxPtToAssociatedPt, rtxPt) {
    var fmtpPattern = new RegExp('a=fmtp:' + rtxPt + ' apt=(\\d+)');
    var matches = mediaSection.match(fmtpPattern);
    if (!matches) {
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    var pt = Number.parseInt(matches[1]);
    if (!ptToCodecName.has(pt)) {
      // This is Issue 8329.
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    var codecName = ptToCodecName.get(pt);
    if (codecName === 'rtx') {
      // Strange
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    return rtxPtToAssociatedPt.set(rtxPt, pt);
  }, new Map());
}

/**
 * @param {string} mediaSection
 * @param {Map<RtxPT, NonRtxPT>} rtxPtToAssociatedPt
 * @param {Set<RtxPT>} invalidRtxPts
 * @returns {Map<NonRtxPT, RtxPT>} associatedPtToRtxPt
 */
function createAssociatedPtToRtxPt(rtxPtToAssociatedPt, invalidRtxPts) {
  // First, we construct a Map<NonRtxPT, NonEmptySet<RtxPT>>.
  var associatedPtToRtxPts = Array.from(rtxPtToAssociatedPt).reduce(function(associatedPtToRtxPts, pair) {
    var rtxPt = pair[0];
    var pt = pair[1];
    var rtxPts = associatedPtToRtxPts.get(pt) || new Set();
    return associatedPtToRtxPts.set(pt, rtxPts.add(rtxPt));
  }, new Map());

  // Then, we filter down to a Map<NonRtxPT, RtxPt>. Any RtxPTs that map to the
  // same NonRtxPT are removed and added to invalidRtxPts.
  return Array.from(associatedPtToRtxPts).reduce(function(associatedPtToRtxPt, pair) {
    var pt = pair[0];
    var rtxPts = Array.from(pair[1]);
    if (rtxPts.length > 1) {
      rtxPts.forEach(function(rtxPt) {
        invalidRtxPts.add(rtxPt);
      });
      return associatedPtToRtxPt;
    }
    return associatedPtToRtxPt.set(pt, rtxPts[0]);
  }, new Map());
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @returns {string} newMediaSection
 */
function deleteFmtpAttributesForRtxPt(mediaSection, rtxPt) {
  var pattern = new RegExp('a=fmtp:' + rtxPt + '.*\r\n', 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @returns {string} newMediaSection
 */
function deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt) {
  var pattern = new RegExp('a=rtpmap:' + rtxPt + '.*\r\n', 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @param {NonRtxPT} pt
 * @returns {string} newMediaSection
 */
function addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt) {
  return mediaSection + 'a=fmtp:' + rtxPt + ' apt=' + pt + '\r\n';
}

module.exports = workaround;
