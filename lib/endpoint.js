'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var CapabilityToken = require('./capabilitytoken');
var util = require('./util');

var SIPUA_FACTORY = require('./signaling').SipUAFactory;

/**
 * Construct a new {@link Endpoint}.
 * @class
 * @classdesc A {@link Endpoint} can make or receive calls to Twilio or other
 *   {@link Endpoint}s.
 * @property {Array<Session>} sessions - active sessions this {@link Endpoint} is
 *   participating in
 * @property {?CapabilityToken} capabilityToken - this {@link Endpoint}'s {@link
 *   CapabilityToken}, if any
 */ 
function Endpoint(options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(options);
  }

  EventEmitter.call(this);

  Object.defineProperty(this, 'uuid', {
    value: util.makeUUID()
  });

  options = options || {};
  var sipUAFactory = 'sipUAFactory' in options
                   ? options['sipUAFactory']
                   : SIPUA_FACTORY.getInstance(options);
  var sipUA = sipUAFactory.addEndpoint(this);
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
    'sessions': {
      get: function() {
        return sipUA.sessions;
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
    console.log('Endpoint emitting "incoming"');
    self.emit('incoming', call);
  });

  sipUA.on('error', function(error) {
    self.emit('error', error);
  });

  sipUA.on('registered', function() {
    self.emit('registered');
  });

  sipUA.on('registrationFailed', function() {
    self.emit('error', new Error('Registration failed'));
  });

  return Object.freeze(this);
}

inherits(Endpoint, EventEmitter);

/**
 * Authenticate this {@link Endpoint} with a {@link CapabilityToken}.
 * @instance
 * @param {string|CapabilityToken} capabilityToken - a string to be parsed to a
 *   {@link CapabilityToken} or a {@link CapabilityToken} itself
 * @returns {Endpoint}
 */
Endpoint.prototype.auth = function auth(capabilityToken) {
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
 * Make an {@link OutgoingSession}.
 * @instance
 * @param {?object} params - application parameters, if any
 * @returns {Endpoint}
 */
Endpoint.prototype.call = function call(params) {
  if (this.capabilityToken === null || !this.capabilityToken.supportsOutgoing) {
    throw new Error('CapabilityToken does not support outgoing calls');
  }
  var _session = this._sipUA.call(this.capabilityToken, params);
  // TODO: Anything else?
  return _session;
};

module.exports = Endpoint;
