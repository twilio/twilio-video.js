'use strict';

var flatMap = require('./').flatMap;

/**
 * Match a pattern across lines, returning the first capture group for any
 * matches.
 * @param {string} pattern
 * @param {string} lines
 * @returns {Set<string>} matches
 */
function getMatches(pattern, lines) {
  var matches = lines.match(new RegExp(pattern, 'gm')) || [];
  return matches.reduce(function(results, line) {
    var match = line.match(new RegExp(pattern));
    return match ? results.add(match[1]) : results;
  }, new Set());
}

/**
 * Get a Set of MediaStreamTrack IDs from an SDP.
 * @param {string} pattern
 * @param {string} sdp
 * @returns {Set<string>}
 */
function getTrackIds(pattern, sdp) {
  return getMatches(pattern, sdp);
}

/**
 * Get a Set of MediaStreamTrack IDs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Set<string>} trackIds
 */
function getPlanBTrackIds(sdp) {
  return getTrackIds('^a=ssrc:[0-9]+ +msid:.+ +(.+) *$', sdp);
}

/**
 * Get a Set of MediaStreamTrack IDs from a Unified Plan SDP.
 * @param {string} sdp - Unified Plan SDP
 * @returns {Set<string>} trackIds
 */
function getUnifiedPlanTrackIds(sdp) {
  return getTrackIds('^a=msid:.+ +(.+) *$', sdp);
}

/**
 * Get a Set of SSRCs for a MediaStreamTrack from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @param {string} trackId - MediaStreamTrack ID
 * @returns {Set<string>}
 */
function getPlanBSSRCs(sdp, trackId) {
  var pattern = '^a=ssrc:([0-9]+) +msid:[^ ]+ +' + trackId + ' *$';
  return getMatches(pattern, sdp);
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
 * Get a Set of SSRCs for a MediaStreamTrack from a Unified Plan SDP.
 * @param {string} sdp - Unified Plan SDP
 * @param {string} trackId - MediaStreamTrack ID
 * @returns {Set<string>}
 */
function getUnifiedPlanSSRCs(sdp, trackId) {
  var mediaSections = sdp.split('\r\nm=').slice(1);

  var msidAttrRegExp = new RegExp('^a=msid:[^ ]+ +' + trackId + ' *$', 'gm');
  var matchingMediaSections = mediaSections.filter(function(mediaSection) {
    return mediaSection.match(msidAttrRegExp);
  });

  return new Set(flatMap(matchingMediaSections, getMediaSectionSSRCs));
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from an SDP.
 * @param {function(string): Set<string>} getTrackIds
 * @param {function(string, string): Set<string>} getSSRCs
 * @param {string} sdp - SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getTrackIdsToSSRCs(getTrackIds, getSSRCs, sdp) {
  return new Map(Array.from(getTrackIds(sdp)).map(function(trackId) {
    return [trackId, getSSRCs(sdp, trackId)];
  }));
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getPlanBTrackIdsToSSRCs(sdp) {
  return getTrackIdsToSSRCs(getPlanBTrackIds, getPlanBSSRCs, sdp);
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getUnifiedPlanTrackIdsToSSRCs(sdp) {
  return getTrackIdsToSSRCs(getUnifiedPlanTrackIds, getUnifiedPlanSSRCs, sdp);
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the SDP itself. This method
 * ensures that SSRCs never change once announced.
 * @param {function(string): Map<string, Set<string>>} getTrackIdsToSSRCs
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - SDP
 * @returns {strinng} updatedSdp - updated SDP
 */
function updateTrackIdsToSSRCs(getTrackIdsToSSRCs, trackIdsToSSRCs, sdp) {
  var newTrackIdsToSSRCs = getTrackIdsToSSRCs(sdp);
  var newSSRCsToOldSSRCs = new Map();

  // NOTE(mroberts): First, update a=ssrc attributes.
  newTrackIdsToSSRCs.forEach(function(ssrcs, trackId) {
    if (!trackIdsToSSRCs.has(trackId)) {
      trackIdsToSSRCs.set(trackId, ssrcs);
      return;
    }
    var oldSSRCs = Array.from(trackIdsToSSRCs.get(trackId));
    var newSSRCs = Array.from(ssrcs);
    oldSSRCs.forEach(function(oldSSRC, i) {
      var newSSRC = newSSRCs[i];
      newSSRCsToOldSSRCs.set(newSSRC, oldSSRC);
      var pattern = '^a=ssrc:' + newSSRC + ' (.*)$';
      var replacement = 'a=ssrc:' + oldSSRC + ' $1';
      sdp = sdp.replace(new RegExp(pattern, 'gm'), replacement);
    });
  });

  // NOTE(mroberts): Then, update a=ssrc-group attributes.
  var pattern = '^(a=ssrc-group:[^ ]+ +)(.*)$';
  var matches = sdp.match(new RegExp(pattern, 'gm')) || [];
  matches.forEach(function(line) {
    var match = line.match(new RegExp(pattern));
    if (!match) {
      return;
    }
    var prefix = match[1];
    var newSSRCs = match[2];
    var oldSSRCs = newSSRCs.split(' ').map(function(newSSRC) {
      var oldSSRC = newSSRCsToOldSSRCs.get(newSSRC);
      return oldSSRC ? oldSSRC : newSSRC;
    }).join(' ');
    sdp = sdp.replace(match[0], prefix + oldSSRCs);
  });

  return sdp;
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the Plan B SDP itself. This
 * method ensures that SSRCs never change once announced.
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - Plan B SDP
 * @returns {string} updatedSdp - updated Plan B SDP
 */
function updatePlanBTrackIdsToSSRCs(trackIdsToSSRCs, sdp) {
  return updateTrackIdsToSSRCs(getPlanBTrackIdsToSSRCs, trackIdsToSSRCs, sdp);
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the Plan B SDP itself. This
 * method ensures that SSRCs never change once announced.
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - Plan B SDP
 * @returns {string} updatedSdp - updated Plan B SDP
 */
function updateUnifiedPlanTrackIdsToSSRCs(trackIdsToSSRCs, sdp) {
  return updateTrackIdsToSSRCs(getUnifiedPlanTrackIdsToSSRCs, trackIdsToSSRCs, sdp);
}

exports.getPlanBTrackIds = getPlanBTrackIds;
exports.getUnifiedPlanTrackIds = getUnifiedPlanTrackIds;
exports.getPlanBSSRCs = getPlanBSSRCs;
exports.getUnifiedPlanSSRCs = getUnifiedPlanSSRCs;
exports.updatePlanBTrackIdsToSSRCs = updatePlanBTrackIdsToSSRCs;
exports.updateUnifiedPlanTrackIdsToSSRCs = updateUnifiedPlanTrackIdsToSSRCs;
