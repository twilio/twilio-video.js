'use strict';

var inherits = require('util').inherits;

var Session = require('./session');
var headers = require('../constants').headers;

/**
 * Constructs a new {@link OutgoingSession}.
 * @class
 * @classdesc An {@link OutgoingSession} represents a call from a {@link Endpoint} to
 *   Twilio or another {@link Endpoint}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Session}
 * @property {?string} sid - the {@link Session} SID, once known
 */
function OutgoingSession(sipua, session) {
  if (!(this instanceof OutgoingSession)) {
    return new OutgoingSession(sipua, session);
  }

  Session.call(this, sipua, session);

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

inherits(OutgoingSession, Session);

/**
 * Cancel an {@link OutgoingSession} before it has been accepted.
 * @instance
 * @returns {OutgoingSession}
 */
OutgoingSession.prototype.cancel = function cancel() {
  this._session.cancel();
  this._sipua._factory.removeSession(this._sipua, this);
  return this;
};

module.exports = OutgoingSession;
