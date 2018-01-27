'use strict';

const LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalDataTrackPublication}.
 * @class
 * @classdesc A {@link LocalDataTrackPublication} is a {@link LocalDataTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalDataTrack}
 * @param {LocalDataTrack} track - the {@link LocalDataTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "data"
 * @property {LocalDataTrack} track - the {@link LocalDataTrack}
 */
class LocalDataTrackPublication extends LocalTrackPublication {
  constructor(sid, track, unpublish, options) {
    super(sid, track, unpublish, options);
  }

  toString() {
    return `[LocalDataTrackPublication #${this._instanceId}: ${this.sid}]`;
  }
}

module.exports = LocalDataTrackPublication;
