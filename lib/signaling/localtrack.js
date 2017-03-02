'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackSignaling}.
 * @class
 * @classdesc A {@link LocalTrack} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalTrackSignaling(mediaStreamTrack) {
  TrackSignaling.call(this,
    mediaStreamTrack.id,
    mediaStreamTrack.kind,
    mediaStreamTrack.enabled);
  this.setMediaStreamTrack(mediaStreamTrack);
}

inherits(LocalTrackSignaling, TrackSignaling);

module.exports = LocalTrackSignaling;
