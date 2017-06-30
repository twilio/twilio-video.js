'use strict';

var inherits = require('util').inherits;
var PublishedTrack = require('./publishedtrack');

/**
 * Construct a {@link PublishedAudioTrack}.
 * @class
 * @classdesc A {@link PublishedAudioTrack} is a {@link LocalAudioTrack} that
 * has been published to a {@link Room}.
 * @extends PublishedTrack
 * @param {Track.SID} sid - SID assigned to the published {@link LocalAudioTrack}
 * @param {Track.ID} id - ID of the published {@link LocalAudioTrack}
 * @param {PublishedTrackOptions} options - {@link PublishedTrack} options
 */
function PublishedAudioTrack(sid, id, options) {
  if (!(this instanceof PublishedAudioTrack)) {
    return new PublishedAudioTrack(sid, id, options);
  }
  PublishedTrack.call(this, sid, id, 'audio', options);
}

inherits(PublishedAudioTrack, PublishedTrack);

PublishedAudioTrack.prototype.toString = function toString() {
  return '[PublishedAudioTrack #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = PublishedAudioTrack;
