'use strict';

const { RTCSessionDescription } = require('../../webrtc');

const { createPtToCodecName, getMediaSections } = require('./');

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
  const descriptionInit = { type: description.type };
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
  const mediaSections = getMediaSections(sdp);
  const session = sdp.split('\r\nm=')[0];
  return [session]
    .concat(mediaSections.map(mediaSectionWorkaround))
    .join('\r\n');
}

/**
 * @param {string} mediaSection
 * @returns {string} newMediaSection
 */
function mediaSectionWorkaround(mediaSection) {
  const ptToCodecName = createPtToCodecName(mediaSection);
  mediaSection = deleteDuplicateRtxPts(mediaSection, ptToCodecName);
  mediaSection = resolvePayloadTypeConflicts(mediaSection);
  const codecNameToPts = createCodecNameToPts(ptToCodecName);
  const rtxPts = codecNameToPts.get('rtx') || new Set();

  const invalidRtxPts = new Set();
  const rtxPtToAssociatedPt = createRtxPtToAssociatedPt(
    mediaSection, ptToCodecName, rtxPts, invalidRtxPts);
  const associatedPtToRtxPt = createAssociatedPtToRtxPt(
    rtxPtToAssociatedPt, invalidRtxPts);

  const unassociatedRtxPts = Array.from(invalidRtxPts);

  // NOTE(mroberts): We normalize to lowercase.
  const knownCodecNames = ['h264', 'vp8', 'vp9'];
  const unassociatedPts = knownCodecNames.reduce((unassociatedPts, codecName) => {
    const pts = codecNameToPts.get(codecName) || new Set();
    return Array.from(pts).reduce((unassociatedPts, pt) => associatedPtToRtxPt.has(pt)
      ? unassociatedPts
      : unassociatedPts.add(pt), unassociatedPts);
  }, new Set());

  unassociatedPts.forEach(pt => {
    if (unassociatedRtxPts.length) {
      const rtxPt = unassociatedRtxPts.shift();
      mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
      mediaSection = addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt);
    }
  });

  unassociatedRtxPts.forEach(rtxPt => {
    mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
    mediaSection = deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt);
  });

  return mediaSection;
}

/**
 * Resolve payload type conflicts where same PT maps to different codecs
 * @param {string} mediaSection
 * @returns {string} resolvedMediaSection
 */
function resolvePayloadTypeConflicts(mediaSection) {
  const lines = mediaSection.split('\r\n');
  const seenPts = new Map(); // PT -> first codec seen
  let nextAvailablePt = 96; // Start from 96, which is the first dynamic PT. See https://datatracker.ietf.org/doc/html/rfc3551#section-3

  for (let i = 0; i < lines.length; i++) {
    const rtpmapMatch = lines[i].match(/^a=rtpmap:(\d+) ([^/]+)/);
    if (rtpmapMatch) {
      const pt = parseInt(rtpmapMatch[1], 10);
      const codec = rtpmapMatch[2].toLowerCase();

      if (seenPts.has(pt) && seenPts.get(pt) !== codec) {
        // Conflict detected - reassign this PT
        while (seenPts.has(nextAvailablePt) || nextAvailablePt === pt) {
          nextAvailablePt++;
        }
        const newPt = nextAvailablePt;
        seenPts.set(newPt, codec);

        lines[i] = lines[i].replace(`a=rtpmap:${pt}`, `a=rtpmap:${newPt}`);

        for (let j = i + 1; j < lines.length; j++) {
          // eslint-disable-next-line max-depth
          if (lines[j].match(new RegExp(`^a=(fmtp|rtcp-fb):${pt}\\b`))) {
            lines[j] = lines[j].replace(new RegExp(`^a=(fmtp|rtcp-fb):${pt}\\b`), `a=$1:${newPt}`);
          }
        }
      } else {
        seenPts.set(pt, codec);
      }
    }
  }

  return lines.join('\r\n');
}


/**
 * @param {string} mediaSection
 * @param {Map<PT, Codec>} ptToCodecName
 * @returns {string} newMediaSection
 */
function deleteDuplicateRtxPts(mediaSection, ptToCodecName) {
  // NOTE(syerrapragada): In some cases Chrome produces an offer/answer
  // with duplicate "rtx" payload mapping in media section. When applied,
  // Chrome rejects the SDP. We workaround this by deleting duplicate
  // "rtx" mappings found in SDP.
  return Array.from(ptToCodecName.keys()).reduce((section, pt) => {
    const rtpmapRegex = new RegExp(`^a=rtpmap:${pt} rtx.+$`, 'gm');
    return (section.match(rtpmapRegex) || []).slice(ptToCodecName.get(pt) === 'rtx' ? 1 : 0).reduce((section, rtpmap) => {
      const rtpmapRegex = new RegExp(`\r\n${rtpmap}`);
      const fmtpmapRegex = new RegExp(`\r\na=fmtp:${pt} apt=[0-9]+`);
      return section.replace(rtpmapRegex, '').replace(fmtpmapRegex, '');
    }, section);
  }, mediaSection);
}

/**
 * @param {Map<PT, Codec>} ptToCodecName
 * @returns {Map<string, NonEmptySet<PT>>} codecNameToPts
 */
function createCodecNameToPts(ptToCodecName) {
  const codecNameToPts = new Map();
  ptToCodecName.forEach((codecName, pt) => {
    const pts = codecNameToPts.get(codecName) || new Set();
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
  return Array.from(rtxPts).reduce((rtxPtToAssociatedPt, rtxPt) => {
    const fmtpPattern = new RegExp(`a=fmtp:${rtxPt} apt=(\\d+)`);
    const matches = mediaSection.match(fmtpPattern);
    if (!matches) {
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    const pt = Number.parseInt(matches[1]);
    if (!ptToCodecName.has(pt)) {
      // This is Issue 8329.
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    const codecName = ptToCodecName.get(pt);
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
  const associatedPtToRtxPts = Array.from(rtxPtToAssociatedPt).reduce((associatedPtToRtxPts, pair) => {
    const rtxPt = pair[0];
    const pt = pair[1];
    const rtxPts = associatedPtToRtxPts.get(pt) || new Set();
    return associatedPtToRtxPts.set(pt, rtxPts.add(rtxPt));
  }, new Map());

  // Then, we filter down to a Map<NonRtxPT, RtxPt>. Any RtxPTs that map to the
  // same NonRtxPT are removed and added to invalidRtxPts.
  return Array.from(associatedPtToRtxPts).reduce((associatedPtToRtxPt, pair) => {
    const pt = pair[0];
    const rtxPts = Array.from(pair[1]);
    if (rtxPts.length > 1) {
      rtxPts.forEach(rtxPt => {
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
  const pattern = new RegExp(`a=fmtp:${rtxPt}.*\r\n`, 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @returns {string} newMediaSection
 */
function deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt) {
  const pattern = new RegExp(`a=rtpmap:${rtxPt}.*\r\n`, 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @param {NonRtxPT} pt
 * @returns {string} newMediaSection
 */
function addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt) {
  return mediaSection.endsWith('\r\n')
    ? `${mediaSection}a=fmtp:${rtxPt} apt=${pt}\r\n`
    : `${mediaSection}\r\na=fmtp:${rtxPt} apt=${pt}`;
}

module.exports = workaround;
