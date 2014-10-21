'use strict';

var inherits = require('util').inherits;

var Call = require('./call');

function OutgoingCall(transport, session) {
  if (!(this instanceof OutgoingCall)) {
    return new OutgoingCall(transport, session);
  }

  Call.call(this, transport, session);

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

OutgoingCall.prototype.cancel = function cancel() {
  this._session.cancel();
  var removeCall = require('./siptransport').removeCall;
  removeCall(this._transport, this);
  return this;
};

module.exports = OutgoingCall;
