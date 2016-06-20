'use strict';

var CancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var constants = require('../../util/constants');
var IncomingInviteV2 = require('./incominginvite');
var inherits = require('util').inherits;
var RTCAuthInfo = require('../rtc-auth-info');
var Signaling = require('../');
var SIP = require('sip.js');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

/**
 * Construct {@link SignalingV2}.
 * @class
 * @classdesc {@link SignalingV2} implements version 2 of our signaling
 * protocol.
 * @extends {Signaling}
 * @param {AccessManager} accessManager
 * @param {?object} [options={}]
 */
function SignalingV2(accessManager, options) {
  var accountSid = accessManager._tokenPayload.sub;
  var uri = util.makeRegistrationSIPURI(accountSid, accessManager.identity);

  /* eslint new-cap:0 */
  options = Object.assign({
    registrarServer: constants.REGISTRAR_SERVER(accountSid),
    wsServer: constants.WS_SERVER(accountSid)
  }, options);

  var debug = options.logLevel === 'debug';
  var useWssHack = options.wsServer.startsWith('wss://');

  var ua = new SIP.UA({
    autostart: false,
    log: {
      builtinEnabled: debug
    },
    extraSupported: ['conversation-events-v2', 'timer'],
    hackAllowUnregisteredOptionTags: true,
    keepAliveInterval: 30,
    mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
    register: false,
    registrarServer: options.registrarServer,
    traceSip: debug,
    uri: uri,
    wsServers: options.wsServer,
    hackWssInTransport: useWssHack
  });

  Signaling.call(this);

  Object.defineProperties(this, {
    _accessManager: {
      value: accessManager
    },
    _iceServers: {
      value: [],
      writable: true
    },
    _options: {
      value: options
    },
    _ua: {
      value: ua
    }
  });
  handleAccessManagerEvents(this, accessManager);
  handleUserAgentEvents(this);
}

inherits(SignalingV2, Signaling);

SignalingV2.prototype._close = function _close(key) {
  this.transition('closing', key);
  this._ua.stop();
  this._ua.transport.disconnect();
  this.transition('closed', key);
  return Promise.resolve(this);
};

SignalingV2.prototype._listen = function _listen(key) {
  var self = this;
  this.transition('attemptingToListen', key);
  return this._register().then(function registerSucceeded() {
    self.transition('listening', key);
    return self;
  });
};

SignalingV2.prototype._open = function _open(key) {
  var self = this;

  function startUA() {
    self._ua.start();
  }

  this.transition('opening', key);
  return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected').then(function() {
    self.transition('open', key);
    return self;
  });
};

SignalingV2.prototype._unlisten = function _unlisten(key) {
  var self = this;
  var token = this._accessManager.token;

  function unregister() {
    var unregisterHeaders = util.makeRegisterHeaders(token);
    self._ua.unregister({ extraHeaders: unregisterHeaders });
  }

  this.transition('attemptingToUnlisten', key);
  return util.promiseFromEvents(unregister, this._ua, 'unregistered').then(function() {
    self.transition('open', key);
    return self;
  });
};

SignalingV2.prototype._register = function _register() {
  var self = this;
  var token = this._accessManager.token;

  function register() {
    var registerHeaders = util.makeRegisterHeaders(token);
    self._ua.register({
      extraHeaders: registerHeaders,
      closeWithHeaders: true
    });
  }

  return util.promiseFromEvents(register, this._ua, 'registered', 'registrationFailed').then(function(response) {
    var rtcAuthInfo;
    try {
      rtcAuthInfo = RTCAuthInfo.parseRTCAuthInfo(response.body);
    } catch (error) {
      return;
    }
    var networkTraversalService = rtcAuthInfo.config.networkTraversalService;
    if (networkTraversalService) {
      self._iceServers = networkTraversalService.ice_servers;
    }
  });
};

SignalingV2.prototype._connect = function _connect(identities, labelOrSid, localMedia, options) {
  identities = identities instanceof Array ? identities : [identities];

  options = Object.assign({
    iceServers: this._iceServers
  }, this._options, options);

  var ua = this._ua;
  var token = this._accessManager.token;
  var accountSid = this._accessManager._tokenPayload.sub;

  return function getCancelablePromise() {
    return new CancelableRoomSignalingPromise(
      accountSid,
      token,
      ua,
      identities,
      labelOrSid,
      localMedia,
      options);
  };
};

function handleAccessManagerEvents(signaling, accessManager) {
  accessManager.on('tokenUpdated', function tokenUpdated() {
    if (signaling.state === 'listening') {
      return signaling._register();
    }
  });
}

function handleUserAgentEvents(signaling) {
  signaling._ua.on('invite', function invite(session) {
    var options = Object.assign({
      iceServers: signaling._iceServers
    }, signaling._options);

    var incomingInvite = new IncomingInviteV2(session, options);

    signaling.emit('invite', incomingInvite);
  });
}

module.exports = SignalingV2;
