'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var mixinRemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');

var RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);

/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isSubscribed - Whether the {@link RemoteVideoTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @emits RemoteVideoTrack#dimensionsChanged
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#unsubscribed
 */

var RemoteVideoTrack = function (_RemoteMediaVideoTrac) {
  _inherits(RemoteVideoTrack, _RemoteMediaVideoTrac);

  /**
   * Construct a {@link RemoteVideoTrack}.
   * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
   * @param {boolean} isEnabled - whether the {@link RemoteAudioTrack} is enabled
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  function RemoteVideoTrack(mediaTrackReceiver, isEnabled, options) {
    _classCallCheck(this, RemoteVideoTrack);

    return _possibleConstructorReturn(this, (RemoteVideoTrack.__proto__ || Object.getPrototypeOf(RemoteVideoTrack)).call(this, mediaTrackReceiver, isEnabled, options));
  }

  _createClass(RemoteVideoTrack, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
    }
  }]);

  return RemoteVideoTrack;
}(RemoteMediaVideoTrack);

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "unpaused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} was unsubscribed from.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   unsubscribed from
 * @event RemoteVideoTrack#unsubscribed
 * @deprecated Use the parent {@link RemoteVideoTrackPublication}'s
 *   "unsubscribed" event instead
 */

module.exports = RemoteVideoTrack;