'use strict';

/**
 * Constructs a SIP {@link Dialog}
 * @class
 * @param {Session} session
 * @param {UserAgent} userAgent
 * @param {Participant} participant
 * @property {UserAgent} userAgent
 * @property {Participant} participant
 */
function Dialog(session, userAgent, participant) {
  if (!(this instanceof Dialog)) {
    return new Dialog(session, userAgent, participant);
  }
  Object.defineProperties(this, {
    session: {
      value: session
    },
    userAgent: {
      value: userAgent
    },
    participant: {
      value: participant
    }
  });
  return Object.freeze(Dialog);
}

module.exports = Dialog;
