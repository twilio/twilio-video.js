'use strict';

var constants = require('../../util/constants');
var inherits = require('util').inherits;
var RTCAuthInfo = require('../rtc-auth-info');
var SIPJS = require('sip.js');
var SIPJSInviteClientTransaction = require('./sipjsinviteclienttransaction.js');
var SIPJSInviteServerTransaction = require('./sipjsinviteservertransaction');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var UserAgent = require('./useragent');
var util = require('../../util');

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @class
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {AccessManager} accessManager
 * @param {object} [options]
 * @augments {UserAgent}
 */
function SIPJSUserAgent(accessManager, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(accessManager, options);
  }

  /* eslint new-cap:0 */

  var accountSid = accessManager._tokenPayload.sub;
  var uri = util.makeRegistrationSIPURI(accountSid, accessManager.identity);

  options = util.withDefaults(options, {
    inviteClientTransactionFactory: SIPJSInviteClientTransaction,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    registrarServer: constants.REGISTRAR_SERVER(accountSid),
    uaFactory: SIPJS.UA
  });

  var wsServer = options.wsServer || constants.WS_SERVER(accountSid);

  // Setup the SIP.js UA.
  var enableDebug = options.logLevel === 'debug';
  var extraSupported = ['conversation-events'];
  var useWssHack = /^wss:\/\//.test(wsServer);
  var UA = options.uaFactory;
  var ua = setupUA.call(this, new UA({
    autostart: false,
    log: {
      builtinEnabled: enableDebug
    },
    extraSupported: extraSupported,
    hackAllowUnregisteredOptionTags: true,
    keepAliveInterval: 30,
    mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
    register: false,
    registrarServer: options.registrarServer,
    traceSip: enableDebug,
    uri: uri,
    wsServers: wsServer,
    hackWssInTransport: useWssHack
  }));

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _ua: {
      value: ua
    }
  });

  UserAgent.call(this, accessManager, options);

  return this;
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype._register = function _register(token) {
  var self = this;

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
      // Do nothing.
    }
    if (rtcAuthInfo) {
      var networkTraversalService = rtcAuthInfo.config.networkTraversalService;
      if (networkTraversalService) {
        self._iceServers = networkTraversalService.ice_servers;
      }
    }
    return self;
  });
};

SIPJSUserAgent.prototype._unregister = function _unregister() {
  var self = this;
  var token = this.accessManager.token;

  function unregister() {
    var unregisterHeaders = util.makeRegisterHeaders(token);
    self._ua.unregister({ extraHeaders: unregisterHeaders });
  }

  return util.promiseFromEvents(unregister, this._ua, 'unregistered').then(function() {
    return self;
  });
};

SIPJSUserAgent.prototype._connect = function _connect() {
  var self = this;

  function startUA() {
    self._ua.start();
  }

  return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected').then(function() {
    return self;
  });
};

SIPJSUserAgent.prototype._disconnect = function _disconnect() {
  this._ua.stop();
  this._ua.transport.disconnect();

  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

function setupUA(ua) {
  /* eslint no-invalid-this:0 */
  var self = this;
  ua.on('invite', function(session) {
    var inviteServerTransaction = new SIPJSInviteServerTransaction(self, session);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  ua.on('keepAliveTimeout', function() {
    self.emit('keepAliveTimeout');
  });
  return ua;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
