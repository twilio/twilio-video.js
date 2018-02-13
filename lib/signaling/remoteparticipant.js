'use strict';

const ParticipantSignaling = require('./participant');

/**
 * A {@link Participant} implementation
 * @extends ParticipantSignaling
 * @property {string} identity
 * @property {Participant.SID} sid
 */
class RemoteParticipantSignaling extends ParticipantSignaling {
  /**
   * Construct a {@link RemoteParticipantSignaling}.
   * @param {Participant.SID} sid
   * @param {string} identity
   */
  constructor(sid, identity) {
    super();
    this.connect(sid, identity);
  }
}

module.exports = RemoteParticipantSignaling;
