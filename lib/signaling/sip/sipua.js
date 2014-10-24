'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var calls = require('../../calls');
var IncomingCall = calls.IncomingCall;
var OutgoingCall = calls.OutgoingCall;
var util = require('../../util');

/**
 * Constructs a new {@link SipUA}.
 * @class
 * @classdesc A {@link SipUA} is a SIP User Agent that makes and receives calls
 *   on behalf of a {@link Peer}.
 * @param {SipUAFactory} factory - the {@link SipUAFactory} that constructed
 *   this {@link SipUA}
 * @param {Peer} peer - the {@link Peer} associated with this {@link SipUA}
 * @property {Array<Call>} calls - the {@link Call}s active on this {@link
 *   SipUA}
 * @property {Peer} peer - the {@link Peer} that owns this {@link SipUA}
 */
function SipUA(factory, peer) {
  if (!(this instanceof SipUA)) {
    return new SipUA(peer, ua);
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
    console.log('SipUA emitting "incoming"');
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

inherits(SipUA, EventEmitter);

/**
 * Close this {@link SipUA} and remove it from the {@link SipUAFactory}.
 * @instance
 * @returns {SipUA}
 */
SipUA.prototype.close = function close() {
  this._factory.removePeer(this.peer);
  setTimeout(this._ua.stop.bind(this._ua));
  return this;
};

/**
 * Make an {@link OutgoingCall}.
 * @instance
 * @param {CapabilityToken} capabilityToken
 * @param {?object} params - outgoing application parameters, if any
 * @returns {OutgoingCall}
 */
SipUA.prototype.call = function call(capabilityToken, params) {
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
      'render': {}
    }
  });

  // Wrap the SipUA.js Session in an OutgoingCall object.
  var _call = new OutgoingCall(this, session);
  this._factory.addCall(this, _call);
  var self = this;
  _call.once('error', function() {
    self._factory.removeCall(self, _call);
  });

  return _call;
};

/**
 * Register on behalf of the {@link Peer}.
 * @instance
 * @param {CapabilityToken} capabilityToken
 * @returns {SipUA}
 */
SipUA.prototype.register = function(capabilityToken) {
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

module.exports = SipUA;
