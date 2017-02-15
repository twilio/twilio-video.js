'use strict';

var constants = require('../../util/constants');
var defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var inherits = require('util').inherits;
var LocalParticipantV2 = require('./localparticipant');
var Signaling = require('../');
var SIP = require('../../sip');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

/**
 * Construct {@link SignalingV2}.
 * @class
 * @classdesc {@link SignalingV2} implements version 2 of our signaling
 * protocol.
 * @extends {Signaling}
 * @param {string} wsServer
 * @param {?object} [options={}]
 */
function SignalingV2(wsServer, options) {
  var uri = util.makeClientSIPURI();

  /* eslint new-cap:0 */
  options = Object.assign({
    createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise,
    registrarServer: constants.REGISTRAR_SERVER,
    UA: SIP.UA
  }, options);

  var debug = options.logLevel === 'debug';
  var useWssHack = wsServer.startsWith('wss://');

  var UA = options.UA;
  var ua = new UA({
    autostart: false,
    log: {
      builtinEnabled: debug
    },
    extraSupported: ['room-signaling', 'timer'],
    hackAllowUnregisteredOptionTags: true,
    keepAliveInterval: 30,
    mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
    register: false,
    registrarServer: options.registrarServer,
    traceSip: debug,
    uri: uri,
    wsServers: wsServer,
    hackWssInTransport: useWssHack
  });

  Signaling.call(this);

  Object.defineProperties(this, {
    _createCancelableRoomSignalingPromise: {
      value: options.createCancelableRoomSignalingPromise
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
  }, function() {
    self.transition('closed', key);
    throw new Error('Open failed');
  });
};

SignalingV2.prototype._connect = function _connect(localParticipant, token, options) {
  options = Object.assign({
    iceServers: constants.DEFAULT_ICE_SERVERS
  }, this._options, options);

  var ua = this._ua;

  return this._createCancelableRoomSignalingPromise.bind(
    null,
    token,
    ua,
    localParticipant,
    options);
};

SignalingV2.prototype.createLocalParticipantSignaling = function createLocalParticipantSignaling() {
  return new LocalParticipantV2();
};

module.exports = SignalingV2;
