'use strict';

var util = require('./');
var getMediaSections = require('./sdp').getMediaSections;

// NOTE(mroberts): TrackMatcher is meant to solve the problem identified in
//
//   https://bugs.webkit.org/show_bug.cgi?id=174519
//
// Namely that, without MIDs, we cannot "correctly" identify MediaStreamTracks
// in Safari's current WebRTC implementation. So, this module tries to hack
// around this by making a possibly dangerous assumption: "track" events will
// be raised for MediaStreamTracks of a particular kind in the same order that
// those kinds' MSIDs appear in the SDP. By calling `update` with an
// RTCPeerConnection's `localDescription` and then invoking `match`, we ought
// to be able to dequeue MediaStreamTrack IDs in the correct order to be
// assigned to "track" events.

/**
 * @typedef {string} ID
 */

/**
 * @interface MatchedAndUnmatched
 * @property {Set<ID>} matched
 * @property {Set<ID>} unmatched
 */

/**
 * Create a new instance of {@link MatchedAndUnmatched}.
 * @returns {MatchedAndUnmatched}
 */
function create() {
  return {
    matched: new Set(),
    unmatched: new Set()
  };
}

/**
 * Attempt to match a MediaStreamTrack ID.
 * @param {MatchedAndUnmatched} mAndM
 * @returns {?string} id
 */
function match(mAndM) {
  var unmatched = Array.from(mAndM.unmatched);
  if (!unmatched.length) {
    return null;
  }
  var id = unmatched[0];
  mAndM.matched.add(id);
  mAndM.unmatched.delete(id);
  return id;
}

/**
 * Update a {@link MatchedAndUnmatched}'s MediaStreamTrack IDs.
 * @param {MatchedAndUnmatched} mAndM
 * @param {Set<ID>} ids
 * @returns {void}
 */
function update(mAndM, ids) {
  ids = new Set(ids);
  var removedMatchedIds = util.difference(mAndM.matched, ids);
  removedMatchedIds.forEach(mAndM.matched.delete, mAndM.matched);
  mAndM.unmatched = util.difference(ids, mAndM.matched);
}

/**
 * Parse MediaStreamTrack IDs of a particular kind from an SDP.
 * @param {string} kind
 * @param {string} sdp
 * @returns {Set<ID>} ids
 */
function parse(kind, sdp) {
  var mediaSections = getMediaSections(sdp, kind);
  var pattern = 'msid: ?(.+) +(.+) ?$';
  return new Set(util.flatMap(mediaSections, function(mediaSection) {
    return mediaSection.match(new RegExp(pattern, 'mg')) || [];
  }).map(function(msid) {
    return msid.match(new RegExp(pattern))[2];
  }));
}

/**
 * A {@link TrackMatcher} is used to match RTCTrackEvents.
 * @property {MatchedAndUnmatched} audio
 * @property {MatchedAndUnmatched} video
 */
function TrackMatcher() {
  if (!(this instanceof TrackMatcher)) {
    return new TrackMatcher();
  }
  Object.defineProperties(this, {
    audio: {
      enumerable: true,
      value: create()
    },
    video: {
      enumerable: true,
      value: create()
    }
  });
}

/**
 * Attempt to match a new MediaStreamTrack ID.
 * @param {string} kind - "audio" or "video"
 * @returns {?ID} id
 */
TrackMatcher.prototype.match = function(kind) {
  return match(this[kind]);
};

/**
 * Update the {@link TrackMatcher} with a new SDP.
 * @param {string} sdp
 * @returns {void}
 */
TrackMatcher.prototype.update = function(sdp) {
  ['audio', 'video'].forEach(function(kind) {
    update(this[kind], parse(kind, sdp));
  }, this);
};

module.exports = TrackMatcher;
