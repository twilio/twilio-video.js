'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('../track');

/**
 * Construct a {@link TrackV2}.
 * @class
 * @extends TrackSignaling
 * @param {TrackV2#Representation} track
 */
function TrackV2(track) {
  TrackSignaling.call(this,
    track.id,
    track.kind,
    track.enabled);
}

inherits(TrackV2, TrackSignaling);

/**
 * Get the {@link TrackV2#Representation} of a given {@link TrackSignaling}.
 * @param {TrackSignaling} track
 * @returns {TrackV2#Representation}
 */
TrackV2.getState = function getState(track) {
  return {
    enabled: track.isEnabled,
    id: track.id,
    kind: track.kind
  };
};

/**
 * Compare the {@link TrackV2} to a {@link TrackV2#Representation} of itself
 * and perform any updates necessary.
 * @param {TrackV2#Representation} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
TrackV2.prototype.update = function update(track) {
  this.enable(track.enabled);
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link TrackV2}
 * @typedef {object} TrackV2#Representation
 * @property {boolean} enabled
 * @property {string} id
 * @property {string} kind
 */

module.exports = TrackV2;
