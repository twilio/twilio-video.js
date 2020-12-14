'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TrackPrioritySignaling = function () {
  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  function TrackPrioritySignaling(mediaSignalingTransport) {
    _classCallCheck(this, TrackPrioritySignaling);

    Object.defineProperties(this, {
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      }
    });
  }

  /**
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   */


  _createClass(TrackPrioritySignaling, [{
    key: 'sendTrackPriorityUpdate',
    value: function sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
      this._mediaSignalingTransport.publish(_defineProperty({
        type: 'track_priority',
        track: trackSid
      }, publishOrSubscribe, priority));
    }
  }]);

  return TrackPrioritySignaling;
}();

module.exports = TrackPrioritySignaling;