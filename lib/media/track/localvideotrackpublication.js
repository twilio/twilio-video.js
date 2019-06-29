'use strict';

const LocalTrackPublication = require('./localtrackpublication');

/**
 * A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that has
 * been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "video"
 * @property {LocalVideoTrack} track - the {@link LocalVideoTrack}
 */
class LocalVideoTrackPublication extends LocalTrackPublication {
  /**
   * Construct a {@link LocalVideoTrackPublication}.
   * @param {LocalTrackPublicationSignaling} signaling - The corresponding
   *   {@link LocalTrackPublicationSignaling}
   * @param {LocalVideoTrack} track - the {@link LocalVideoTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  constructor(signaling, track, unpublish, options) {
    super(signaling, track, unpublish, options);
  }

  toString() {
    return `[LocalVideoTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

module.exports = LocalVideoTrackPublication;
