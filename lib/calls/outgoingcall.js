'use strict';

var inherits = require('util').inherits;

var Call = require('./call');
var headers = require('../constants').headers;

/**
 * Constructs a new {@link OutgoingCall}.
 * @class
 * @classdesc An {@link OutgoingCall} represents a call from a {@link Peer} to
 *   Twilio or another {@link Peer}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Call}
 * @property {?string} sid - the {@link Call} SID, once known
 */
function OutgoingCall(sipua, session) {
  if (!(this instanceof OutgoingCall)) {
    return new OutgoingCall(sipua, session);
  }

  Call.call(this, sipua, session);

  var _callSid = null;
  var _response = null;
  Object.defineProperties(this, {
    // Private
    _response: {
      get: function() {
        return _response;
      },
      set: function(response) {
        _response = response;
        _callSid = response.getHeader(headers.X_TWILIO_CALLSID);
      }
    },
    // Public
    'sid': {
      get: function() {
        return _callSid;
      }
    }
  });

  var self = this;

  session.once('accepted', function() {
    self.emit('connected');
  });

  session.once('failed', function() {
    self.emit('error');
  });

  session.once('rejected', function() {
    self.emit('error');
  });

  return Object.freeze(this);
}

inherits(OutgoingCall, Call);

/**
 * Cancel an {@link OutgoingCall} before it has been accepted.
 * @instance
 * @returns {OutgoingCall}
 */
OutgoingCall.prototype.cancel = function cancel() {
  this._session.cancel();
  this._sipua._factory.removeCall(this._sipua, this);
  return this;
};

module.exports = OutgoingCall;
