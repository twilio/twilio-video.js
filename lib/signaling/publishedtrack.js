'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link PublishedTrackSignaling}.
 * @class
 * @classdesc A {@link PublishedTrack} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function PublishedTrackSignaling(mediaStreamTrack) {
  TrackSignaling.call(this,
    mediaStreamTrack.id,
    mediaStreamTrack.kind,
    mediaStreamTrack.enabled);
  this.setMediaStreamTrack(mediaStreamTrack);
}

inherits(PublishedTrackSignaling, TrackSignaling);

module.exports = PublishedTrackSignaling;
