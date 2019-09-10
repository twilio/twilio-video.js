'use strict';

const TrackPublication = require('./trackpublication');

/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @property {boolean} isSubscribed - whether the published {@link RemoteTrack}
 *   is subscribed to
 * @property {boolean} isTrackEnabled - whether the published
 *   {@link RemoteTrack} is enabled
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {Track.Priority} publishPriority - the priority of the published
 *   {@link RemoteTrack} set by the {@link RemoteParticipant}
 * @property {?RemoteTrack} track - Unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @emits RemoteTrackPublication#subscribed
 * @emits RemoteTrackPublication#subscriptionFailed
 * @emits RemoteTrackPublication#trackDisabled
 * @emits RemoteTrackPublication#trackEnabled
 * @emits RemoteTrackPublication#trackSwitchedOff
 * @emits RemoteTrackPublication#trackSwitchedOn
 * @emits RemoteTrackPublication#unsubscribed
 *
 */
class RemoteTrackPublication extends TrackPublication {
  /**
   * Construct a {@link RemoteTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling.name, signaling.sid, options);

    Object.defineProperties(this, {
      _signaling: {
        value: signaling
      },
      _track: {
        value: null,
        writable: true
      },
      isSubscribed: {
        enumerable: true,
        get() {
          return !!this._track;
        }
      },
      isTrackEnabled: {
        enumerable: true,
        get() {
          return this._signaling.isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: signaling.kind
      },
      publishPriority: {
        enumerable: true,
        value: signaling.priority
      },
      track: {
        enumerable: true,
        get() {
          return this._track;
        }
      }
    });

    let error = null;
    let isEnabled;
    let isSwitchedOff = false;

    signaling.on('updated', () => {
      if (error !== signaling.error) {
        error = signaling.error;
        this.emit('subscriptionFailed', signaling.error);
        return;
      }
      if (isEnabled !== signaling.isEnabled) {
        isEnabled = signaling.isEnabled;
        if (this.track) {
          this.track._setEnabled(signaling.isEnabled);
        }
        this.emit(signaling.isEnabled ? 'trackEnabled' : 'trackDisabled');
      }
      if (isSwitchedOff !== signaling.isSwitchedOff) {
        isSwitchedOff = signaling.isSwitchedOff;
        if (this.track) {
          this.track._setSwitchedOff(signaling.isSwitchedOff);
          this.emit(signaling.isSwitchedOff ? 'trackSwitchedOff' : 'trackSwitchedOn',  this.track);
        }
      }
    });
  }

  toString() {
    return `[RemoteTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }

  /**
   * @private
   * @param {RemoteTrack} track
   */
  _subscribed(track) {
    if (!this._track && track) {
      this._track = track;
      this.emit('subscribed', track);
    }
  }

  /**
   * @private
   */
  _unsubscribe() {
    if (this._track) {
      const track = this._track;
      this._track = null;
      this.emit('unsubscribed', track);
    }
  }
}

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
