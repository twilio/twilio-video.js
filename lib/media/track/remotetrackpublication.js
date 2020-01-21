'use strict';

const TrackPublication = require('./trackpublication');

/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @extends TrackPublication
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @emits RemoteTrackPublication#subscribed
 * @emits RemoteTrackPublication#trackDisabled
 * @emits RemoteTrackPublication#trackEnabled
 * @emits RemoteTrackPublication#unsubscribed
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
      kind: {
        enumerable: true,
        value: signaling.kind
      }
    });

    signaling.on('updated', () => {
      if (signaling.error) {
        this.emit('subscriptionFailed', signaling.error);
        return;
      }
      if (this.track) {
        this.track._setEnabled(signaling.isEnabled);
      }
      this.emit(signaling.isEnabled ? 'trackEnabled' : 'trackDisabled');
    });
  }

  toString() {
    return `[RemoteTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }

  /**
   * Whether the published {@link RemoteTrack} is subscribed to
   * @property {boolean}
   */
  get isSubscribed() {
    return !!this._track;
  }

  /**
   * Whether the published {@link RemoteTrack} is enabled
   * @property {boolean}
   */
  get isTrackEnabled() {
    return this._signaling.isEnabled;
  }

  /**
   * Unless you have subscribed to the {@link RemoteTrack}, this property is null
   * @property {?RemoteTrack}
   */
  get track() {
    return this._track;
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
      track._unsubscribe();
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
 * The {@link RemoteTrack} was disabled.
 * @event RemoteTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteTrack} was enabled.
 * @event RemoteTrackPublication#trackEnabled
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
