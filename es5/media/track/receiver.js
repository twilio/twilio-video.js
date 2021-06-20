'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @extends MediaTrackTransceiver
 */

var MediaTrackReceiver = function (_MediaTrackTransceive) {
  _inherits(MediaTrackReceiver, _MediaTrackTransceive);

  /**
   * Construct a {@link MediaTrackReceiver}.
   * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
   * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
   */
  function MediaTrackReceiver(id, mediaStreamTrack) {
    _classCallCheck(this, MediaTrackReceiver);

    return _possibleConstructorReturn(this, (MediaTrackReceiver.__proto__ || Object.getPrototypeOf(MediaTrackReceiver)).call(this, id, mediaStreamTrack));
  }

  return MediaTrackReceiver;
}(MediaTrackTransceiver);

module.exports = MediaTrackReceiver;