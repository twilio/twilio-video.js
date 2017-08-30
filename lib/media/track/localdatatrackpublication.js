'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

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
function LocalDataTrackPublication(sid, track, unpublish, options) {
  if (!(this instanceof LocalDataTrackPublication)) {
    return new LocalDataTrackPublication(sid, track, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, track, unpublish, options);
}

inherits(LocalDataTrackPublication, LocalTrackPublication);

LocalDataTrackPublication.prototype.toString = function toString() {
  return '[LocalDataTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalDataTrackPublication;
