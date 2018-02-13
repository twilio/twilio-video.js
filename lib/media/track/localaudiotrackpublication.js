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
   * @param {Track.SID} sid - SID assigned to the published {@link LocalAudioTrack}
   * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  constructor(sid, track, unpublish, options) {
    super(sid, track, unpublish, options);
  }

  toString() {
    return `[LocalAudioTrackPublication #${this._instanceId}: ${this.sid}]`;
  }
}

module.exports = LocalAudioTrackPublication;
