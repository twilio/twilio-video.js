'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackSignaling}.
 * @class
 * @classdesc A {@link LocalTrack} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
 */
function LocalTrackSignaling(mediaStreamTrack, mediaStream) {
  TrackSignaling.call(this,
    mediaStreamTrack.id,
    mediaStreamTrack.kind,
    mediaStreamTrack.enabled);
  this.setMediaStreamTrack(mediaStreamTrack, mediaStream);
}

inherits(LocalTrackSignaling, TrackSignaling);

module.exports = LocalTrackSignaling;
