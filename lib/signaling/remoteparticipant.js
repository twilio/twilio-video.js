'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('./participant');

/**
 * Construct a {@link RemoteParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends ParticipantSignaling
 * @param {Participant.SID} sid
 * @param {string} identity
 * @property {string} identity
 * @property {Participant.SID} sid
 */
function RemoteParticipantSignaling(sid, identity) {
  ParticipantSignaling.call(this);
  this.connect(sid, identity);
}

inherits(RemoteParticipantSignaling, ParticipantSignaling);

module.exports = RemoteParticipantSignaling;
