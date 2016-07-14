'use strict';

var inherits = require('util').inherits;
var Participant = require('./participant');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Client} in a
 * {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 */
function LocalParticipant(signaling) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling);
  }
  Participant.call(this, signaling);
}

inherits(LocalParticipant, Participant);

module.exports = LocalParticipant;
