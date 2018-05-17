'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackTransceiver = require('../../transceiver');

/**
 * A {@link MediaTrackTransceiver} represents either one or more local
 * RTCRtpSenders, or a single RTCRtpReceiver.
 * @extends TrackTransceiver
 * @property {MediaStreamTrack} track
 */

var MediaTrackTransceiver = function (_TrackTransceiver) {
  _inherits(MediaTrackTransceiver, _TrackTransceiver);

  /**
   * Construct a {@link MediaTrackTransceiver}.
   * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
   * @param {MediaStreamTrack} mediaStreamTrack
   */
  function MediaTrackTransceiver(id, mediaStreamTrack) {
    _classCallCheck(this, MediaTrackTransceiver);

    var _this = _possibleConstructorReturn(this, (MediaTrackTransceiver.__proto__ || Object.getPrototypeOf(MediaTrackTransceiver)).call(this, id, mediaStreamTrack.kind));

    Object.defineProperties(_this, {
      readyState: {
        enumerable: true,
        get: function get() {
          return mediaStreamTrack.readyState;
        }
      },
      track: {
        enumerable: true,
        value: mediaStreamTrack
      }
    });
    return _this;
  }

  return MediaTrackTransceiver;
}(TrackTransceiver);

module.exports = MediaTrackTransceiver;