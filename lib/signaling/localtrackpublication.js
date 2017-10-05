'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack|DataTrackSender} mediaStreamTrackOrDataTrackSender
 * @param {string} name
 */
function LocalTrackPublicationSignaling(mediaStreamTrackOrDataTrackSender, name) {
  var enabled = mediaStreamTrackOrDataTrackSender.kind === 'data'
    ? true
    : mediaStreamTrackOrDataTrackSender.enabled;
  TrackSignaling.call(this,
    name,
    mediaStreamTrackOrDataTrackSender.id,
    mediaStreamTrackOrDataTrackSender.kind,
    enabled);
  this.setMediaStreamTrackOrDataTrackTransceiver(mediaStreamTrackOrDataTrackSender);
}

inherits(LocalTrackPublicationSignaling, TrackSignaling);

module.exports = LocalTrackPublicationSignaling;
