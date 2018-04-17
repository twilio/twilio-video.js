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
   * @param {Track.SID} trackSid - SID assigned to the published {@link LocalAudioTrack}
   * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  constructor(trackSid, track, unpublish, options) {
    super(trackSid, track, unpublish, options);
  }

  toString() {
    return `[LocalAudioTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

module.exports = LocalAudioTrackPublication;
