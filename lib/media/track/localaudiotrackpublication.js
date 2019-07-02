'use strict';

const LocalTrackPublication = require('./localtrackpublication');

/**
 * A {@link LocalAudioTrackPublication} is a {@link LocalAudioTrack} that has
 * been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "audio"
 * @property {LocalAudioTrack} track - the {@link LocalAudioTrack}
 */
class LocalAudioTrackPublication extends LocalTrackPublication {
  /**
   * Construct a {@link LocalAudioTrackPublication}.
   * @param {LocalTrackPublicationSignaling} signaling - The corresponding
   *   {@link LocalTrackPublicationSignaling}
   * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  constructor(signaling, track, unpublish, options) {
    super(signaling, track, unpublish, options);
  }

  toString() {
    return `[LocalAudioTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

module.exports = LocalAudioTrackPublication;
