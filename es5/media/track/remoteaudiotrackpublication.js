'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteAudioTrackPublication} represents a {@link RemoteAudioTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "audio"
 * @property {?RemoteAudioTrack} track - unless you have subscribed to the
 *   {@link RemoteAudioTrack}, this property is null
 * @emits RemoteAudioTrackPublication#subscribed
 * @emits RemoteAudioTrackPublication#subscriptionFailed
 * @emits RemoteAudioTrackPublication#trackDisabled
 * @emits RemoteAudioTrackPublication#trackEnabled
 * @emits RemoteAudioTrackPublication#unsubscribed
 */

var RemoteAudioTrackPublication = function (_RemoteTrackPublicati) {
  _inherits(RemoteAudioTrackPublication, _RemoteTrackPublicati);

  /**
   * Construct a {@link RemoteAudioTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  function RemoteAudioTrackPublication(signaling, options) {
    _classCallCheck(this, RemoteAudioTrackPublication);

    return _possibleConstructorReturn(this, (RemoteAudioTrackPublication.__proto__ || Object.getPrototypeOf(RemoteAudioTrackPublication)).call(this, signaling, options));
  }

  _createClass(RemoteAudioTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteAudioTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return RemoteAudioTrackPublication;
}(RemoteTrackPublication);

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was subscribed to
 * @event RemoteAudioTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteAudioTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteAudioTrack} could not be
 *   subscribed to
 * @event RemoteAudioTrackPublication#subscriptionFailed
 */

/**
 * The {@link RemoteAudioTrack} was disabled.
 * @event RemoteAudioTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled.
 * @event RemoteAudioTrackPublication#trackEnabled
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was unsubscribed from
 * @event RemoteAudioTrackPublication#unsubscribed
 */

module.exports = RemoteAudioTrackPublication;