'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var util = require('../util');

/**
 * Mixin for {@link IncomingSession} and {@link OutgoingSession}.
 * @class
 * @classdesc {@link Session} is an abstract class. For concrete instances, see
 *   {@link IncomingSession} and {@link OutgoingSession}.
 * @param {SipUA} sipua - the {@link SipUA} responsible for this {@link Session}
 * @property {?string} sid - the {@link Session} SID, once known
 */
function Session(sipua, session, render) {
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

inherits(Session, EventEmitter);

/**
 * Hangup the {@link Session}.
 * @instance
 * @returns {@link Session}
 */
Session.prototype.hangup = function hangup() {
  this._session.bye();
  this._sipua._factory.removeSession(this._sipua, this);
  return this;
};

module.exports = Session;

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
