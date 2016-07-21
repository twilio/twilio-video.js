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
 * @param {LocalMedia} localMedia
 */
function LocalParticipant(signaling, localMedia) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localMedia);
  }
  Participant.call(this, signaling, localMedia);
}

inherits(LocalParticipant, Participant);

module.exports = LocalParticipant;
