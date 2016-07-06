'use strict';

var inherits = require('util').inherits;
var Participant = require('./participant');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Client} in a
 * {@link Room}.
 * @param {ParticipantSignaling} signaling
 * @property {Participant.Identity} identity - The identity of the {@link LocalParticipant}
 * @property {Media} media - The {@link LocalMedia} this {@link Participant} is sharing
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected" or "disconnected"
 * @fires Participant#connected
 * @fires Participant#disconnected
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function LocalParticipant(signaling) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling);
  }
  Participant.call(this, signaling);
}

inherits(LocalParticipant, Participant);

module.exports = LocalParticipant;
