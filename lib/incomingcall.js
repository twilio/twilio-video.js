'use strict';

var inherits = require('util').inherits;

var Call = require('./call');
var headers = require('./headers');
var util = require('./util');

function IncomingCall(transport, session) {
  if (!(this instanceof IncomingCall)) {
    return new IncomingCall(transport, session);
  }

  Call.call(this, transport, session);

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

IncomingCall.prototype.accept = function accept() {
  this._session.accept();
  var addCall = require('./siptransport').addCall;
  addCall(this._transport, this);
  return this;
};

IncomingCall.prototype.reject = function reject() {
  this._session.reject();
  return this;
};

module.exports = IncomingCall;
