'use strict';

var inherits = require('util').inherits;
var PublishedTrack = require('./publishedtrack');

/**
 * Construct a {@link PublishedVideoTrack}.
 * @class
 * @classdesc A {@link PublishedVideoTrack} is a {@link LocalVideoTrack} that
 * has been published to a {@link Room}.
 * @extends PublishedTrack
 * @param {Track.SID} sid - SID assigned to the published {@link LocalVideoTrack}
 * @param {Track.ID} id - ID of the published {@link LocalVideoTrack}
 * @param {function(PublishedTrack): void} unpublish - The callback
 *    that unpublishes the {@link PublishedTrack}
 * @param {PublishedTrackOptions} options - {@link PublishedTrack} options
 */
function PublishedVideoTrack(sid, id, unpublish, options) {
  if (!(this instanceof PublishedVideoTrack)) {
    return new PublishedVideoTrack(sid, id, unpublish, options);
  }
  PublishedTrack.call(this, sid, id, 'video', unpublish, options);
}

inherits(PublishedVideoTrack, PublishedTrack);

PublishedVideoTrack.prototype.toString = function toString() {
  return '[PublishedVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = PublishedVideoTrack;
