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
function Dialog(userAgent, session, participant, stream) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    '_stream': {
      set: function(_stream) {
        stream = _stream;
      }
    },
    'session': {
      value: session
    },
    'stream': {
      get: function() {
        return stream;
      }
    },
    'userAgent': {
      value: userAgent
    },
    'participant': {
      value: participant
    }
  });
  return this;
}

inherits(Dialog, EventEmitter);

module.exports = Dialog;
