'use strict';

const RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteDataTrackPublication} represents a {@link RemoteDataTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "data"
 * @property {?RemoteDataTrack} track - unless you have subscribed to the
 *   {@link RemoteDataTrack}, this property is null
 * @emits RemoteDataTrackPublication#subscribed
 * @emits RemoteDataTrackPublication#unsubscribed
 */
class RemoteDataTrackPublication extends RemoteTrackPublication {
  /**
   * Construct a {@link RemoteDataTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling, options);
  }

  toString() {
    return `[RemoteDataTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was subscribed to
 * @event RemoteDataTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was unsubscribed from
 * @event RemoteDataTrackPublication#unsubscribed
 */

module.exports = RemoteDataTrackPublication;
