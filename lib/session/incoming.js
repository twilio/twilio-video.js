'use strict';

var inherits = require('util').inherits;

var Session = require('./session');
var headers = require('../constants').headers;
var util = require('../util');

/**
 * Constructs a new {@link IncomingSession}.
 * @class
 * @classdesc An {@link IncomingSession} represents a call to a {@link Endpoint} from
 *   Twilio or another {@link Endpoint}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Session}
 * @property {string} sid - the {@link Session} SID
 */
function IncomingSession(sipua, session, render) {
  if (!(this instanceof IncomingSession)) {
    return new IncomingSession(sipua, session, render);
  }

  Session.call(this, sipua, session, render);

  var request = session.request;
  Object.defineProperties(this, {
    // Private
    _request: {
      value: request
    },
    // Public
    'sid': {
      value: request.getHeader(headers.X_TWILIO_CALLSID)
    }
  });

  return Object.freeze(this);
}

inherits(IncomingSession, Session);

/**
 * Accept the {@link IncomingSession}.
 * @instance
 * @returns {IncomingSession}
 */
IncomingSession.prototype.accept = function accept() {
  this._session.accept();
  this._sipua._factory.addSession(this._sipua, this);
  return this;
};

/**
 * Reject the {@link IncomingSession}.
 * @instance
 * @returns {IncomingSession}
 */
IncomingSession.prototype.reject = function reject() {
  this._session.reject();
  return this;
};

module.exports = IncomingSession;
