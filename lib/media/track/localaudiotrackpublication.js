'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalAudioTrackPublication}.
 * @class
 * @classdesc A {@link LocalAudioTrackPublication} is a {@link LocalAudioTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalAudioTrack}
 * @param {Track.ID} id - ID of the published {@link LocalAudioTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 */
function LocalAudioTrackPublication(sid, id, unpublish, options) {
  if (!(this instanceof LocalAudioTrackPublication)) {
    return new LocalAudioTrackPublication(sid, id, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, id, 'audio', unpublish, options);
}

inherits(LocalAudioTrackPublication, LocalTrackPublication);

LocalAudioTrackPublication.prototype.toString = function toString() {
  return '[LocalAudioTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalAudioTrackPublication;
