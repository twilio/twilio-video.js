'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalTrackPublicationSignaling(mediaStreamTrack) {
  TrackSignaling.call(this,
    mediaStreamTrack.id,
    mediaStreamTrack.kind,
    mediaStreamTrack.enabled);
  this.setMediaStreamTrack(mediaStreamTrack);
}

inherits(LocalTrackPublicationSignaling, TrackSignaling);

module.exports = LocalTrackPublicationSignaling;
