'use strict';

const { flatMap } = require('./');

/**
 * Match a pattern across lines, returning the first capture group for any
 * matches.
 * @param {string} pattern
 * @param {string} lines
 * @returns {Set<string>} matches
 */
function getMatches(pattern, lines) {
  const matches = lines.match(new RegExp(pattern, 'gm')) || [];
  return matches.reduce((results, line) => {
    const match = line.match(new RegExp(pattern));
    return match ? results.add(match[1]) : results;
  }, new Set());
}

/**
 * Get a Set of MediaStreamTrack IDs from an SDP.
 * @param {string} sdp - SDP
 * @returns {Set<string>} trackIds
 */
function getTrackIds(sdp) {
  return getMatches('^a=msid:.+ +(.+) *$', sdp);
}

/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp -  sdp string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind = '.*', direction = '.*') {
  return sdp.split('\r\nm=').slice(1).map(mediaSection => `m=${mediaSection}`).filter(mediaSection => {
    const kindPattern = new RegExp(`m=${kind}`, 'gm');
    const directionPattern = new RegExp(`a=${direction}`, 'gm');
    return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
  });
}

/**
 * Get the Set of SSRCs announced in a MediaSection.
 * @param {string} mediaSection
 * @returns {Array<string>} ssrcs
 */
function getMediaSectionSSRCs(mediaSection) {
  return Array.from(getMatches('^a=ssrc:([0-9]+) +.*$', mediaSection));
}

/**
 * Get a Set of SSRCs for a MediaStreamTrack from an SDP.
 * @param {string} sdp - SDP
 * @param {string} trackId - MediaStreamTrack ID
 * @returns {Set<string>}
 */
function getSSRCs(sdp, trackId) {
  const mediaSections = getMediaSections(sdp);

  const msidAttrRegExp = new RegExp(`^a=msid:[^ ]+ +${trackId} *$`, 'gm');
  const matchingMediaSections = mediaSections.filter(mediaSection => mediaSection.match(msidAttrRegExp));

  return new Set(flatMap(matchingMediaSections, getMediaSectionSSRCs));
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from an SDP.
 * @param {string} sdp - SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getTrackIdsToSSRCs(sdp) {
  return new Map(Array.from(getTrackIds(sdp)).map(trackId => [trackId, getSSRCs(sdp, trackId)]));
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the SDP itself. This method
 * ensures that SSRCs never change once announced.
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - SDP
 * @returns {string} updatedSdp - updated SDP
 */
function updateTrackIdsToSSRCs(trackIdsToSSRCs, sdp) {
  const newTrackIdsToSSRCs = getTrackIdsToSSRCs(sdp);
  const newSSRCsToOldSSRCs = new Map();

  // NOTE(mroberts): First, update a=ssrc attributes.
  newTrackIdsToSSRCs.forEach((ssrcs, trackId) => {
    if (!trackIdsToSSRCs.has(trackId)) {
      trackIdsToSSRCs.set(trackId, ssrcs);
      return;
    }
    const oldSSRCs = Array.from(trackIdsToSSRCs.get(trackId));
    const newSSRCs = Array.from(ssrcs);
    oldSSRCs.forEach((oldSSRC, i) => {
      const newSSRC = newSSRCs[i];
      newSSRCsToOldSSRCs.set(newSSRC, oldSSRC);
      const pattern = `^a=ssrc:${newSSRC} (.*)$`;
      const replacement = `a=ssrc:${oldSSRC} $1`;
      sdp = sdp.replace(new RegExp(pattern, 'gm'), replacement);
    });
  });

  // NOTE(mroberts): Then, update a=ssrc-group attributes.
  const pattern = '^(a=ssrc-group:[^ ]+ +)(.*)$';
  const matches = sdp.match(new RegExp(pattern, 'gm')) || [];
  matches.forEach(line => {
    const match = line.match(new RegExp(pattern));
    if (!match) {
      return;
    }
    const prefix = match[1];
    const newSSRCs = match[2];
    const oldSSRCs = newSSRCs.split(' ').map(newSSRC => {
      const oldSSRC = newSSRCsToOldSSRCs.get(newSSRC);
      return oldSSRC ? oldSSRC : newSSRC;
    }).join(' ');
    sdp = sdp.replace(match[0], prefix + oldSSRCs);
  });

  return sdp;
}

exports.getMediaSections = getMediaSections;
exports.getTrackIds = getTrackIds;
exports.getSSRCs = getSSRCs;
exports.updateTrackIdsToSSRCs = updateTrackIdsToSSRCs;
