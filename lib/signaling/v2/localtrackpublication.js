'use strict';

var inherits = require('util').inherits;
var LocalTrackPublicationSignaling = require('../localtrackpublication');

/**
 * Construct a {@link LocalTrackPublicationV2}.
 * @class
 * @extends LocalTrackPublicationSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalTrackPublicationV2(mediaStreamTrack) {
  if (!(this instanceof LocalTrackPublicationV2)) {
    return new LocalTrackPublicationV2(mediaStreamTrack);
  }
  LocalTrackPublicationSignaling.call(this, mediaStreamTrack);
}

inherits(LocalTrackPublicationV2, LocalTrackPublicationSignaling);

/**
 * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
 * @returns {LocalTrackPublicationV2#Representation} - without the SID
 */
LocalTrackPublicationV2.prototype.getState = function getState() {
  return {
    enabled: this.isEnabled,
    id: this.id,
    kind: this.kind
  };
};

/**
 * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
 * and perform any updates necessary.
 * @param {LocalTrackPublicationV2#Representation} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
LocalTrackPublicationV2.prototype.update = function update(track) {
  this.setSid(track.sid);
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link LocalTrackPublicationV2}
 * @typedef {object} LocalTrackPublicationV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {string} kind
 * @property {Track.SID} sid
 */

module.exports = LocalTrackPublicationV2;
