'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalVideoTrackPublication}.
 * @class
 * @classdesc A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalVideoTrack}
 * @param {Track.ID} id - ID of the published {@link LocalVideoTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 */
function LocalVideoTrackPublication(sid, id, unpublish, options) {
  if (!(this instanceof LocalVideoTrackPublication)) {
    return new LocalVideoTrackPublication(sid, id, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, id, 'video', unpublish, options);
}

inherits(LocalVideoTrackPublication, LocalTrackPublication);

LocalVideoTrackPublication.prototype.toString = function toString() {
  return '[LocalVideoTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalVideoTrackPublication;
