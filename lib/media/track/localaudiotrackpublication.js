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
 * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "audio"
 * @property {LocalAudioTrack} track - the {@link LocalAudioTrack}
 */
function LocalAudioTrackPublication(sid, track, unpublish, options) {
  if (!(this instanceof LocalAudioTrackPublication)) {
    return new LocalAudioTrackPublication(sid, track, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, track, unpublish, options);
}

inherits(LocalAudioTrackPublication, LocalTrackPublication);

LocalAudioTrackPublication.prototype.toString = function toString() {
  return '[LocalAudioTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalAudioTrackPublication;
