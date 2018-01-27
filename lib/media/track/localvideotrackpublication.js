'use strict';

const LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalVideoTrackPublication}.
 * @class
 * @classdesc A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalVideoTrack}
 * @param {LocalVideoTrack} track - the {@link LocalVideoTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "video"
 * @property {LocalVideoTrack} track - the {@link LocalVideoTrack}
 */
class LocalVideoTrackPublication extends LocalTrackPublication {
  constructor(sid, track, unpublish, options) {
    super(sid, track, unpublish, options);
  }

  toString() {
    return `[LocalVideoTrackPublication #${this._instanceId}: ${this.sid}]`;
  }
}

module.exports = LocalVideoTrackPublication;
