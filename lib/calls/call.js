'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var util = require('../util');

/**
 * Mixin for {@link IncomingCall} and {@link OutgoingCall}.
 * @class
 * @classdesc {@link Call} is an abstract class. For concrete instances, see
 *   {@link IncomingCall} and {@link OutgoingCall}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Call}
 * @property {?string} sid - the {@link Call} SID, once known
 */
function Call(sipua, session, render) {
  EventEmitter.call(this);
  render = render || DEFAULT_RENDER;
  Object.defineProperties(this, {
    // Private
    _render: {
      value: render
    },
    _session: {
      value: session
    },
    _sipua: {
      value: sipua
    },
    // Public
    'uuid': {
      value: util.makeUUID()
    }
  });
  session.on('failed', function(e) {
    var error = {
      code: e['status_code'],
      message: e['reason_phrase']
    };
    sipua.emit('error', error);
  });
  return this;
}

inherits(Call, EventEmitter);

/**
 * Hangup the {@link Call}.
 * @instance
 * @returns {@link Call}
 */
Call.prototype.hangup = function hangup() {
  this._session.bye();
  this._sipua._factory.removeCall(this._sipua, this);
  return this;
};

module.exports = Call;

var DEFAULT_RENDER = {
  'local': {
    'video': (function() {
      return typeof document !== 'undefined'
        ? document.getElementById('localVideo')
        : {};
    })()
  },
  'remote': {
    'video': (function() {
      return typeof document !== 'undefined'
        ? document.getElementById('remoteVideo')
        : {};
    })()
  }
};
