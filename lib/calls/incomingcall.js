'use strict';

var inherits = require('util').inherits;

var Call = require('./call');
var headers = require('../constants').headers;
var util = require('../util');

/**
 * Constructs a new {@link IncomingCall}.
 * @class
 * @classdesc An {@link IncomingCall} represents a call to a {@link Peer} from
 *   Twilio or another {@link Peer}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Call}
 * @property {string} sid - the {@link Call} SID
 */
function IncomingCall(sipua, session, render) {
  if (!(this instanceof IncomingCall)) {
    return new IncomingCall(sipua, session, render);
  }

  Call.call(this, sipua, session, render);

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

inherits(IncomingCall, Call);

/**
 * Accept the {@link IncomingCall}.
 * @instance
 * @returns {IncomingCall}
 */
IncomingCall.prototype.accept = function accept() {
  this._session.accept();
  this._sipua._factory.addCall(this._sipua, this);
  return this;
};

/**
 * Reject the {@link IncomingCall}.
 * @instance
 * @returns {IncomingCall}
 */
IncomingCall.prototype.reject = function reject() {
  this._session.reject();
  return this;
};

module.exports = IncomingCall;
