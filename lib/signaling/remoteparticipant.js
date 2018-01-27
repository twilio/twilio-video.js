'use strict';

const ParticipantSignaling = require('./participant');

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
class RemoteParticipantSignaling extends ParticipantSignaling {
  constructor(sid, identity) {
    super();
    this.connect(sid, identity);
  }
}

module.exports = RemoteParticipantSignaling;
