'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack|LocalDataStreamTrack} mediaOrDataStreamTrack
 */
function LocalTrackPublicationSignaling(mediaOrDataStreamTrack) {
  var enabled = mediaOrDataStreamTrack.kind === 'data'
    ? true
    : mediaOrDataStreamTrack.enabled;
  TrackSignaling.call(this,
    mediaOrDataStreamTrack.id,
    mediaOrDataStreamTrack.kind,
    enabled);
  this.setMediaOrDataStreamTrack(mediaOrDataStreamTrack);
}

inherits(LocalTrackPublicationSignaling, TrackSignaling);

module.exports = LocalTrackPublicationSignaling;
