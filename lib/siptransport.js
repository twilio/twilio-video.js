'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var constants = require('./constants');
var IncomingCall = require('./incomingcall');
var OutgoingCall = require('./outgoingcall');
var util = require('./util');

// Defaults
var DEBUG = false;
var UA = require('sip.js').UA;
var WS_SERVER = constants.WS_SERVER;

var instance = null;

function SIPTransportFactory(options) {
  if (!(this instanceof SIPTransportFactory)) {
    return new SIPTransportFactory(options);
  }

  EventEmitter.call(this);

  options = options || {};
  var debug    = 'debug'    in options ? options['debug']    : DEBUG;
  var ua       = 'UA'       in options ? options['UA']       : UA;
  var wsServer = 'wsServer' in options ? options['wsServer'] : WS_SERVER;
  var self = this;
  Object.defineProperties(this, {
    // Private
    _debug: {
      value: debug
    },
    _peers: {
      value: {}
    },
    _sipTransports: {
      value: {}
    },
    _UA: {
      value: ua
    },
    _wsServer: {
      value: wsServer
    },
    // Public
    'peers': {
      get: function() {
        return util.getKeys(self._peers);
      }
    },
    'transports': {
      get: function() {
        return util.getValues(self._sipTransports);
      }
    }
  });

  return Object.freeze(this);
}

inherits(SIPTransportFactory, EventEmitter);

SIPTransportFactory.getInstance = function getInstance(options) {
  return instance || (instance = new SIPTransportFactory(options));
};

SIPTransportFactory.reset = function reset() {
  if (instance) {
    instance.transports.forEach(function(transport) {
      transport.close();
    });
    instance = null;
  }
};

SIPTransportFactory.prototype.reset = SIPTransportFactory.reset;

SIPTransportFactory.prototype.addPeer = function addPeer(peer) {
  if (this._peers[peer.uuid]) {
    throw new Error('Peer ' + peer.uuid + ' already present on SIPTransportFactory');
  }

  // Add the Peer
  this._peers[peer.uuid] = peer;

  // Add the Peer's UA
  var transport = new SIPTransport(this, peer);
  this._sipTransports[peer.uuid] = transport;

  return transport;
};

SIPTransportFactory.prototype.hasPeer = function hasPeer(peer) {
  return peer.uuid in this._peers;
};

SIPTransportFactory.prototype.removePeer = function removePeer(peer) {
  if (peer.uuid in this._peers) {
    delete this._peers[peer.uuid];
    var transport = this._sipTransports[peer.uuid];
    delete this._sipTransports[peer.uuid];
    transport.close();
    return peer;
  }
  return null;
};

function SIPTransport(factory, peer) {
  if (!(this instanceof SIPTransport)) {
    return new SIPTransport(peer, ua);
  }

  EventEmitter.call(this);

  var ua = new factory._UA({
    'autostart': false,
    'register': false,
    'traceSip': factory._debug,
    'stunServers': 'invalid',
    'wsServers': [factory._wsServer, factory._wsServer],
    'log': {
      'builtinEnabled': factory._debug
    }
  });

  var self = this;
  Object.defineProperties(this, {
    // Private
    _calls: {
      value: {}
    },
    _factory: {
      value: factory
    },
    _ua: {
      value: ua
    },
    // Public
    'calls': {
      get: function() {
        return util.getValues(self._calls);
      }
    },
    'peer': {
      value: peer
    }
  });

  ua.on('invite', function(session) {
    var call = new IncomingCall(self, session);
    self.emit('incoming', call);
  });

  ua.on('registered', function() {
    self.emit('registered');
  });

  ua.on('registrationFailed', function() {
    self.emit('registrationFailed');
  });

  setTimeout(ua.start.bind(ua));

  return Object.freeze(this);
}

inherits(SIPTransport, EventEmitter);

SIPTransport.prototype.close = function close() {
  this._factory.removePeer(this.peer);
  setTimeout(this._ua.stop.bind(this._ua));
};

SIPTransport.prototype.call = function call(capabilityToken, params) {
  params = params || {};
  var target = util.makeURI(capabilityToken.accountSid,
                            capabilityToken.outgoingAppSid);
  var deviceInfo = {p:'browser'};
  var inviteHeaders = util.makeInviteHeaders(deviceInfo, capabilityToken, params);
  var session = this._ua.invite(target, {
    'extraHeaders': inviteHeaders,
    'media': {
      'constraints': {
        'audio': true,
        'video': false
      },
      'render': {
        'local': {
          'video': (function(){return typeof document !== 'undefined' ? document.getElementById('localVideo') : {}})()
        },
        'remove': {
          'video': (function(){return typeof document !== 'undefined' ? document.getElementById('localVideo') : {}})()
        }
      }
    }
  });

  // Wrap the SIP.js Session in an OutgoingCall object.
  var call = new OutgoingCall(this, session);
  addCall(this, call);
  var self = this;
  call.once('error', function() {
    removeCall(self, call);
  });

  return call;
};

SIPTransport.prototype.register = function(capabilityToken) {
  var deviceInfo = {p:'browser'};
  var registerHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken);
  var self = this;
  function register() {
    var registerUri = util.makeURI(capabilityToken.accountSid,
                                   capabilityToken.incomingClientName)
                    + ';rtp_profile=RTP_SAVPF'; 
    self._ua.register({
      'extraHeaders': registerHeaders
    });
  }
  if (this._ua.isConnected()) {
    register();
  } else {
    this._ua.once('connected', register);
  }
  return this;
};

function addCall(sipTransport, call) {
  if (sipTransport._calls[call.uuid]) {
    throw new Error('Call ' + call.uuid + ' already present on SIPTransport');
  }
  sipTransport._calls[call.uuid] = call;
  return sipTransport;
}

function removeCall(sipTransport, call) {
  var removed = sipTransport._calls[call.uuid];
  delete sipTransport._calls[call.uuid];
  return removed;
}

module.exports.SIPTransportFactory = SIPTransportFactory;
module.exports.addCall = addCall;
module.exports.removeCall = removeCall;
