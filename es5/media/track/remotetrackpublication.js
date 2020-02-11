'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackPublication = require('./trackpublication');

/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isSubscribed - whether the published {@link RemoteTrack}
 *   is subscribed to
 * @property {boolean} isTrackEnabled - whether the published
 *   {@link RemoteTrack} is enabled
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {Track.Priority} publishPriority - the {@link Track.Priority} of the published
 *   {@link RemoteTrack} set by the {@link RemoteParticipant}
 * @property {?RemoteTrack} track - Unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @emits RemoteTrackPublication#publishPriorityChanged
 * @emits RemoteTrackPublication#subscribed
 * @emits RemoteTrackPublication#subscriptionFailed
 * @emits RemoteTrackPublication#trackDisabled
 * @emits RemoteTrackPublication#trackEnabled
 * @emits RemoteTrackPublication#trackSwitchedOff
 * @emits RemoteTrackPublication#trackSwitchedOn
 * @emits RemoteTrackPublication#unsubscribed
 *
 */

var RemoteTrackPublication = function (_TrackPublication) {
  _inherits(RemoteTrackPublication, _TrackPublication);

  /**
   * Construct a {@link RemoteTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  function RemoteTrackPublication(signaling, options) {
    _classCallCheck(this, RemoteTrackPublication);

    var _this = _possibleConstructorReturn(this, (RemoteTrackPublication.__proto__ || Object.getPrototypeOf(RemoteTrackPublication)).call(this, signaling.name, signaling.sid, options));

    Object.defineProperties(_this, {
      _signaling: {
        value: signaling
      },
      _track: {
        value: null,
        writable: true
      },
      isSubscribed: {
        enumerable: true,
        get: function get() {
          return !!this._track;
        }
      },
      isTrackEnabled: {
        enumerable: true,
        get: function get() {
          return signaling.isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: signaling.kind
      },
      publishPriority: {
        enumerable: true,
        get: function get() {
          return signaling.priority;
        }
      },
      track: {
        enumerable: true,
        get: function get() {
          return this._track;
        }
      }
    });

    // remember original state, and fire events only on change.
    var error = signaling.error,
        isEnabled = signaling.isEnabled,
        isSwitchedOff = signaling.isSwitchedOff,
        priority = signaling.priority;


    signaling.on('updated', function () {
      if (error !== signaling.error) {
        error = signaling.error;
        _this.emit('subscriptionFailed', signaling.error);
        return;
      }
      if (isEnabled !== signaling.isEnabled) {
        isEnabled = signaling.isEnabled;
        if (_this.track) {
          _this.track._setEnabled(signaling.isEnabled);
        }
        _this.emit(signaling.isEnabled ? 'trackEnabled' : 'trackDisabled');
      }
      if (isSwitchedOff !== signaling.isSwitchedOff) {
        isSwitchedOff = signaling.isSwitchedOff;
        if (_this.track) {
          _this.track._setSwitchedOff(signaling.isSwitchedOff);
          _this.emit(signaling.isSwitchedOff ? 'trackSwitchedOff' : 'trackSwitchedOn', _this.track);
        }
      }
      if (priority !== signaling.priority) {
        priority = signaling.priority;
        _this.emit('publishPriorityChanged', priority);
      }
    });
    return _this;
  }

  _createClass(RemoteTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }

    /**
     * @private
     * @param {RemoteTrack} track
     */

  }, {
    key: '_subscribed',
    value: function _subscribed(track) {
      if (!this._track && track) {
        this._track = track;
        this.emit('subscribed', track);
      }
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribe',
    value: function _unsubscribe() {
      if (this._track) {
        var track = this._track;
        this._track = null;
        this.emit('unsubscribed', track);
      }
    }
  }]);

  return RemoteTrackPublication;
}(TrackPublication);

/**
 * The {@link RemoteTrack}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority}; RemoteTrackPublication#publishPriority is also
 *   updated accordingly
 * @event RemoteTrackPublication#publishPriorityChanged
 */

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was subscribed to
 * @event RemoteTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @event RemoteTrackPublication#subscriptionFailed
 */

/**
 * The {@link RemoteTrack} was disabled.
 * @event RemoteTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteTrack} was enabled.
 * @event RemoteTrackPublication#trackEnabled
 */

/**
 * The {@link RemoteTrack} was switched off.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched off
 * @event RemoteTrackPublication#trackSwitchedOff
 */

/**
 * The {@link RemoteTrack} was switched on.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched on
 * @event RemoteTrackPublication#trackSwitchedOn
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was unsubscribed from
 * @event RemoteTrackPublication#unsubscribed
 */

/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = RemoteTrackPublication;