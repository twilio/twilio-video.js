'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteDataTrackPublication} represents a {@link RemoteDataTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "data"
 * @property {?RemoteDataTrack} track - unless you have subscribed to the
 *   {@link RemoteDataTrack}, this property is null
 * @emits RemoteDataTrackPublication#subscribed
 * @emits RemoteDataTrackPublication#subscriptionFailed
 * @emits RemoteDataTrackPublication#unsubscribed
 */

var RemoteDataTrackPublication = function (_RemoteTrackPublicati) {
  _inherits(RemoteDataTrackPublication, _RemoteTrackPublicati);

  /**
   * Construct a {@link RemoteDataTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  function RemoteDataTrackPublication(signaling, options) {
    _classCallCheck(this, RemoteDataTrackPublication);

    return _possibleConstructorReturn(this, (RemoteDataTrackPublication.__proto__ || Object.getPrototypeOf(RemoteDataTrackPublication)).call(this, signaling, options));
  }

  _createClass(RemoteDataTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteDataTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return RemoteDataTrackPublication;
}(RemoteTrackPublication);

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was subscribed to
 * @event RemoteDataTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteDataTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteDataTrack} could not be
 *   subscribed to
 * @event RemoteDataTrackPublication#subscriptionFailed
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was unsubscribed from
 * @event RemoteDataTrackPublication#unsubscribed
 */

module.exports = RemoteDataTrackPublication;