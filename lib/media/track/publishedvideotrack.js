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
 * @param {PublishedTrackOptions} options - {@link PublishedTrack} options
 */
function PublishedVideoTrack(sid, id, options) {
  if (!(this instanceof PublishedVideoTrack)) {
    return new PublishedVideoTrack(sid, id, options);
  }
  PublishedTrack.call(this, sid, id, 'video', options);
}

inherits(PublishedVideoTrack, PublishedTrack);

PublishedVideoTrack.prototype.toString = function toString() {
  return '[PublishedVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = PublishedVideoTrack;
