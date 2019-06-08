'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var util = require('../../');
var getMediaSections = require('../').getMediaSections;

// NOTE(mroberts): OrderedTrackMatcher is meant to solve the problem identified in
//
//   https://bugs.webkit.org/show_bug.cgi?id=174519
//
// Namely that, without MIDs, we cannot "correctly" identify MediaStreamTracks
// in Safari's current WebRTC implementation. So, this module tries to hack
// around this by making a possibly dangerous assumption: "track" events will
// be raised for MediaStreamTracks of a particular kind in the same order that
// those kinds' MSIDs appear in the SDP. By calling `update` with an
// RTCPeerConnection's `remoteDescription` and then invoking `match`, we ought
// to be able to dequeue MediaStreamTrack IDs in the correct order to be
// assigned to "track" events.

/**
 * @interface MatchedAndUnmatched
 * @property {Set<Track.ID>} matched
 * @property {Set<Track.ID>} unmatched
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
 * @returns {?Track.ID} id
 */
function _match(mAndM) {
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
 * @param {Set<Track.ID>} ids
 * @returns {void}
 */
function _update(mAndM, ids) {
  ids = new Set(ids);
  var removedMatchedIds = util.difference(mAndM.matched, ids);
  removedMatchedIds.forEach(mAndM.matched.delete, mAndM.matched);
  mAndM.unmatched = util.difference(ids, mAndM.matched);
}

/**
 * Parse MediaStreamTrack IDs of a particular kind from an SDP.
 * @param {string} kind
 * @param {string} sdp
 * @returns {Set<Track.ID>} ids
 */
function parse(kind, sdp) {
  var mediaSections = getMediaSections(sdp, kind);
  var pattern = 'msid: ?(.+) +(.+) ?$';
  return new Set(util.flatMap(mediaSections, function (mediaSection) {
    return mediaSection.match(new RegExp(pattern, 'mg')) || [];
  }).map(function (msid) {
    return msid.match(new RegExp(pattern))[2];
  }));
}

/**
 * A {@link OrderedTrackMatcher} is used to match RTCTrackEvents.
 * @property {MatchedAndUnmatched} audio
 * @property {MatchedAndUnmatched} video
 */

var OrderedTrackMatcher = function () {
  function OrderedTrackMatcher() {
    _classCallCheck(this, OrderedTrackMatcher);

    if (!(this instanceof OrderedTrackMatcher)) {
      return new OrderedTrackMatcher();
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
   * @param {RTCTrackEvent} event
   * @returns {?Track.ID} id
   */


  _createClass(OrderedTrackMatcher, [{
    key: 'match',
    value: function match(event) {
      return _match(this[event.track.kind]);
    }

    /**
     * Update the {@link OrderedTrackMatcher} with a new SDP.
     * @param {string} sdp
     * @returns {void}
     */

  }, {
    key: 'update',
    value: function update(sdp) {
      ['audio', 'video'].forEach(function (kind) {
        _update(this[kind], parse(kind, sdp));
      }, this);
    }
  }]);

  return OrderedTrackMatcher;
}();

module.exports = OrderedTrackMatcher;