'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Constructs a SIP {@link Dialog}
 * @class
 * @param {UserAgent} userAgent
 * @param {Session} session
 * @param {Participant} participant
 * @property {Session} session
 * @property {UserAgent} userAgent
 * @property {Participant} participant
 * @fires Dialog#hangup
 */
function Dialog(userAgent, session, participant) {
  EventEmitter.call(this);
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
  return this;
}

inherits(Dialog, EventEmitter);

module.exports = Dialog;
