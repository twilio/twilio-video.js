'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var CapabilityToken = require('./capabilitytoken');
var util = require('./util');

var TRANSPORT_FACTORY = require('./siptransport').SIPTransportFactory;

function Peer(options) {
  if (!(this instanceof Peer)) {
    return new Peer(options);
  }

  EventEmitter.call(this);

  Object.defineProperty(this, 'uuid', {
    value: util.makeUUID()
  });

  options = options || {};
  var transportFactory = 'transportFactory' in options
                       ? options['transportFactory']
                       : TRANSPORT_FACTORY.getInstance();
  var transport = transportFactory.addPeer(this);
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
    _transport: {
      value: transport
    },
    // Public
    'calls': {
      get: function() {
        return transport.calls;
      }
    },
    'capabilityToken': {
      get: function() {
        return _capabilityToken;
      }
    }
  });

  var self = this;

  transport.on('incoming', function(call) {
    self.emit('incoming', call);
  });

  transport.on('registered', function() {
    self.emit('registered');
  });

  transport.on('registrationFailed', function() {
    console.log(arguments);
    self.emit('error', new Error('Registration failed'));
  });

  return Object.freeze(this);
}

inherits(Peer, EventEmitter);

Peer.prototype.auth = function auth(capabilityToken) {
  if (typeof capabilityToken === 'string') {
    capabilityToken = new CapabilityToken(capabilityToken);
  }
  if (capabilityToken instanceof CapabilityToken) {
    this._capabilityToken = capabilityToken;
    if (capabilityToken.supportsIncoming) {
      this._transport.register(capabilityToken);
    }
  }
  return this;
}

Peer.prototype.call = function call(params) {
  if (this.capabilityToken === null || !this.capabilityToken.supportsOutgoing) {
    throw new Error('CapabilityToken does not support outgoing calls');
  }
  var call = this._transport.call(this.capabilityToken, params);
  // TODO: Anything else?
  return call;
};

module.exports = Peer;
