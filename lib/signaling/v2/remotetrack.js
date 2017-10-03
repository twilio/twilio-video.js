'use strict';

var inherits = require('util').inherits;
var RemoteTrackSignaling = require('../remotetrack');

/**
 * Construct a {@link RemoteTrackV2}.
 * @class
 * @extends RemoteTrackSignaling
 * @param {RemoteTrackV2#Representation} track
 */
function RemoteTrackV2(track) {
  if (!(this instanceof RemoteTrackV2)) {
    return new RemoteTrackV2(track);
  }
  RemoteTrackSignaling.call(this,
    track.sid,
    track.name,
    track.id,
    track.kind,
    track.enabled);
}

inherits(RemoteTrackV2, RemoteTrackSignaling);

/**
 * Compare the {@link RemoteTrackV2} to a {@link RemoteTrackV2#Representation} of itself
 * and perform any updates necessary.
 * @param {RemoteTrackV2#Representation} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
RemoteTrackV2.prototype.update = function update(track) {
  this.enable(track.enabled);
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackV2}
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackV2#Representation
 * @property (boolean} subscribed
 */

module.exports = RemoteTrackV2;
