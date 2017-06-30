'use strict';

var inherits = require('util').inherits;
var PublishedTrackSignaling = require('../publishedtrack');

/**
 * Construct a {@link PublishedTrackV2}.
 * @class
 * @extends PublishedTrackSignaling
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function PublishedTrackV2(mediaStreamTrack) {
  if (!(this instanceof PublishedTrackV2)) {
    return new PublishedTrackV2(mediaStreamTrack);
  }
  PublishedTrackSignaling.call(this, mediaStreamTrack);
}

inherits(PublishedTrackV2, PublishedTrackSignaling);

/**
 * Get the {@link PublishedTrackV2#Representation} of a given {@link TrackSignaling}.
 * @returns {PublishedTrackV2#Representation} - without the SID
 */
PublishedTrackV2.prototype.getState = function getState() {
  return {
    enabled: this.isEnabled,
    id: this.id,
    kind: this.kind
  };
};

/**
 * Compare the {@link PublishedTrackV2} to a {@link PublishedTrackV2#Representation} of itself
 * and perform any updates necessary.
 * @param {PublishedTrackV2#Representation} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
PublishedTrackV2.prototype.update = function update(track) {
  this.setSid(track.sid);
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link PublishedTrackV2}
 * @typedef {object} PublishedTrackV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {string} kind
 * @property {Track.SID} sid
 */

module.exports = PublishedTrackV2;
