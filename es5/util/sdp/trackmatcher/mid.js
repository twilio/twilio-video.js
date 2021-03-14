'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var getMediaSections = require('../').getMediaSections;

/**
 * An {@link MIDTrackMatcher} matches an RTCTrackEvent with a MediaStreamTrack
 * ID based on the MID of the underlying RTCRtpTransceiver.
 */

var MIDTrackMatcher = function () {
  /**
   * Construct an {@link MIDTrackMatcher}.
   */
  function MIDTrackMatcher() {
    _classCallCheck(this, MIDTrackMatcher);

    Object.defineProperties(this, {
      _midsToTrackIds: {
        value: new Map(),
        writable: true
      }
    });
  }

  /**
   * Match a given MediaStreamTrack with its ID.
   * @param {RTCTrackEvent} event
   * @returns {?Track.ID}
   */


  _createClass(MIDTrackMatcher, [{
    key: 'match',
    value: function match(event) {
      return this._midsToTrackIds.get(event.transceiver.mid) || null;
    }

    /**
     * Update the {@link MIDTrackMatcher} with a new SDP.
     * @param {string} sdp
     */

  }, {
    key: 'update',
    value: function update(sdp) {
      var sections = getMediaSections(sdp, '(audio|video)');
      this._midsToTrackIds = sections.reduce(function (midsToTrackIds, section) {
        var midMatches = section.match(/^a=mid:(.+)$/m) || [];
        var trackIdMatches = section.match(/^a=msid:.+ (.+)$/m) || [];
        var mid = midMatches[1];
        var trackId = trackIdMatches[1];
        return mid && trackId ? midsToTrackIds.set(mid, trackId) : midsToTrackIds;
      }, this._midsToTrackIds);
    }
  }]);

  return MIDTrackMatcher;
}();

module.exports = MIDTrackMatcher;