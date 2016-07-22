'use strict';

var createCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var constants = require('../../util/constants');
var inherits = require('util').inherits;
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
    _options: {
      value: options
    },
    _ua: {
      value: ua
    }
  });
}

inherits(SignalingV2, Signaling);

SignalingV2.prototype._close = function _close(key) {
  this.transition('closing', key);
  this._ua.stop();
  this._ua.transport.disconnect();
  this.transition('closed', key);
  return Promise.resolve(this);
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

SignalingV2.prototype._connect = function _connect(localParticipant, options) {
  options = Object.assign({
    iceServers: constants.DEFAULT_ICE_SERVERS
  }, this._options, options);

  var ua = this._ua;
  var token = this._accessManager.token;
  var accountSid = this._accessManager._tokenPayload.sub;

  return createCancelableRoomSignalingPromise.bind(
    null,
    accountSid,
    token,
    ua,
    localParticipant,
    options);
};

module.exports = SignalingV2;
