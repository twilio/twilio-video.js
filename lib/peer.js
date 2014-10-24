'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var CapabilityToken = require('./capabilitytoken');
var util = require('./util');

var SIPUA_FACTORY = require('./signaling').SipUAFactory;

/**
 * Construct a new {@link Peer}.
 * @class
 * @classdesc A {@link Peer} can make or receive calls to Twilio or other
 *   {@link Peer}s.
 * @property {Array<Call>} calls - active calls this {@link Peer} is
 *   participating in
 * @property {?CapabilityToken} capabilityToken - this {@link Peer}'s {@link
 *   CapabilityToken}, if any
 */ 
function Peer(options) {
  if (!(this instanceof Peer)) {
    return new Peer(options);
  }

  EventEmitter.call(this);

  Object.defineProperty(this, 'uuid', {
    value: util.makeUUID()
  });

  options = options || {};
  var sipUAFactory = 'sipUAFactory' in options
                   ? options['sipUAFactory']
                   : SIPUA_FACTORY.getInstance(options);
  var sipUA = sipUAFactory.addPeer(this);
  var _capabilityToken = null;
  Object.defineProperties(this, {
    // Private
    _capabilityToken: {
      get: function() {
        return _capabilityToken;
      },
      set: function(capabilityToken) {
        _capabilityToken = capabilityToken;
      }
    },
    _sipUA: {
      value: sipUA
    },
    // Public
    'calls': {
      get: function() {
        return sipUA.calls;
      }
    },
    'capabilityToken': {
      get: function() {
        return _capabilityToken;
      }
    }
  });

  var self = this;

  sipUA.on('incoming', function(call) {
    console.log('Peer emitting "incoming"');
    self.emit('incoming', call);
  });

  sipUA.on('error', function(error) {
    self.emit('error', error);
  });

  sipUA.on('registered', function() {
    self.emit('registered');
  });

  sipUA.on('registrationFailed', function() {
    console.log(arguments);
    self.emit('error', new Error('Registration failed'));
  });

  return Object.freeze(this);
}

inherits(Peer, EventEmitter);

/**
 * Authenticate this {@link Peer} with a {@link CapabilityToken}.
 * @instance
 * @param {string|CapabilityToken} capabilityToken - a string to be parsed to a
 *   {@link CapabilityToken} or a {@link CapabilityToken} itself
 * @returns {Peer}
 */
Peer.prototype.auth = function auth(capabilityToken) {
  if (typeof capabilityToken === 'string') {
    capabilityToken = new CapabilityToken(capabilityToken);
  }
  if (capabilityToken instanceof CapabilityToken) {
    this._capabilityToken = capabilityToken;
    if (capabilityToken.supportsIncoming) {
      this._sipUA.register(capabilityToken);
    }
  }
  return this;
};

/**
 * Make an {@link OutgoingCall}.
 * @instance
 * @param {?object} params - application parameters, if any
 * @returns {Peer}
 */
Peer.prototype.call = function call(params) {
  if (this.capabilityToken === null || !this.capabilityToken.supportsOutgoing) {
    throw new Error('CapabilityToken does not support outgoing calls');
  }
  var _call = this._sipUA.call(this.capabilityToken, params);
  // TODO: Anything else?
  return _call;
};

module.exports = Peer;
