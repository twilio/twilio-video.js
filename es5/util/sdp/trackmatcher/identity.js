'use strict';

/**
 * An {@link IdentityTrackMatcher} matches RTCTrackEvents with their respective
 * MediaStreamTrack IDs.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IdentityTrackMatcher = function () {
  function IdentityTrackMatcher() {
    _classCallCheck(this, IdentityTrackMatcher);
  }

  _createClass(IdentityTrackMatcher, [{
    key: 'match',

    /**
    * Match a given MediaStreamTrack with its ID.
    * @param {RTCTrackEvent} event
    * @returns {Track.ID}
    */
    value: function match(event) {
      return event.track.id;
    }

    /**
    * Update the {@link IdentityTrackMatcher} with a new SDP.
    * @param {string} sdp
    */

  }, {
    key: 'update',
    value: function update() {}
  }]);

  return IdentityTrackMatcher;
}();

module.exports = IdentityTrackMatcher;