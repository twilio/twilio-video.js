'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var util = require('./util');

function Call(transport, session) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    // Private
    _session: {
      value: session
    },
    _transport: {
      value: transport
    },
    // Public
    'uuid': {
      value: util.makeUUID()
    }
  });
  return this;
}

inherits(Call, EventEmitter);

Call.prototype.hangup = function hangup() {
  this._session.bye();
  var removeCall = require('./siptransport').removeCall;
  removeCall(this._transport, this);
  return this;
};

module.exports = Call;
