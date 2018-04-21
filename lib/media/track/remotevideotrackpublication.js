'use strict';

const RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteVideoTrackPublication} represents a {@link RemoteVideoTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "video"
 * @property {?RemoteVideoTrack} track - unless you have subscribed to the
 *   {@link RemoteVideoTrack}, this property is null
 * @emits RemoteVideoTrackPublication#subscribed
 * @emits RemoteVideoTrackPublication#trackDisabled
 * @emits RemoteVideoTrackPublication#trackEnabled
 * @emits RemoteVideoTrackPublication#unsubscribed
 */
class RemoteVideoTrackPublication extends RemoteTrackPublication {
  /**
   * Construct a {@link RemoteVideoTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling, options);
  }

  toString() {
    return `[RemoteVideoTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was subscribed to
 * @event RemoteVideoTrackPublication#subscribed
 */

/**
 * The {@link RemoteVideoTrack} was disabled.
 * @event RemoteVideoTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled.
 * @event RemoteVideoTrackPublication#trackEnabled
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was unsubscribed from
 * @event RemoteVideoTrackPublication#unsubscribed
 */

module.exports = RemoteVideoTrackPublication;
