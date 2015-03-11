'use strict';

var constants = require('../util/constants');
var headers = constants.headers;
var inherits = require('util').inherits;
var Log = require('../util/log');
var Q = require('q');
var Conversation = require('../conversation');
var Stream = require('../media/stream');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var SIPJSInviteClientTransaction = require('./invitetransaction/sipjsinviteclienttransaction.js');
var SIPJSInviteServerTransaction = require('./invitetransaction/sipjsinviteservertransaction');
var Token = require('../token');
var UserAgent = require('./useragent');
var util = require('../util');

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @classdesc
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {(Token|string)} token
 * @param {?object} options
 * @augments {UserAgent}
 * @fires UserAgent#invite
 * @fires UserAgent#registered
 * @fires UserAgent#unregistered
 * @fires UserAgent#registrationFailed
 */
function SIPJSUserAgent(token, options) {
  token = typeof token === 'string' ? new Token(token) : token;
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(token, options);
  }

  var accountSid = token.accountSid;

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'inviteClientTransactionFactory': SIPJSInviteClientTransaction,
    'logLevel': Log.INFO,
    'registrarServer': constants['REGISTRAR_SERVER'](accountSid),
    'wsServer': constants['WS_SERVER'](accountSid)
  });

  var capabilityToken = token;

  var address = token.incomingClientName;
  // var uri = address + '@twil.io';
  var uri = address + '@' + accountSid + '.twil.io';

  var deviceInfo = {'p': 'browser'};
  var extraHeaders =
    util.makeRegisterHeaders(deviceInfo, capabilityToken);

  /*var iceServers = stunTurnToken.ice_servers;
  var stunServerUrl = iceServers[0].url.split('?')[0];
  var turnServerUrl = iceServers[1].url.split('?')[0];
  var turnServerUsername = stunTurnToken.username;
  var turnServerPassword = stunTurnToken.password;
  var turnServerInfo = {
    urls: turnServerUrl,
    username: turnServerUsername,
    password: turnServerPassword
  };*/
  var stunServerUrl = null;
  var turnServerInfo = null;

  var UA = options['uaFactory'] || SIPJS.UA;
  var ua = new UA({
    'autostart': false,
    'extraHeaders': extraHeaders,
    'log': {
      'builtinEnabled': options['debug']
    },
    'register': false,
    'registrarServer': options['registrarServer'],
    'stunServers': stunServerUrl,
    'traceSip': options['debug'],
    'turnServers': turnServerInfo,
    'uri': uri,
    'wsServers': options['wsServer']
  });

  Object.defineProperties(this, {
    _ua: {
      value: ua
    }
  });

  UserAgent.call(this, token, options);

  setupUAListeners(this, ua);
  ua.start();

  return Object.freeze(this);
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype.register = function register(token) {
  var deferred = Q.defer();

  if (token) {
    token = typeof token === 'string' ? new Token(token) : token;
  }
  var capabilityToken = token || this.token;
  var deviceInfo = { 'p': 'browser' };
  var registerHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken);

  var self = this;

  function registered(error) {
    self._ua.off('registered', this);
    self._ua.off('registrationFailed', this);
    if (error) {
      return deferred.reject(error);
    }
    self._registered = true;
    self._token = capabilityToken;
    deferred.resolve(this);
    // Here we ensure that we unregister.
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeUnload', function(event) {
        self.unregister();
      });
    }
  }

  function register() {
    self._ua.register({
      'extraHeaders': registerHeaders
    });
    self._ua.once('registered', function() {
      self.emit('registered');
      registered();
    });
    self._ua.once('registrationFailed', function(error) {
      self.emit('registrationFailed', error);
      registered(error);
    });
  }

  if (this._ua.isConnected()) {
    register();
  } else {
    this._ua.once('connected', register);
  }

  return deferred.promise;
};

SIPJSUserAgent.prototype.unregister = function unregister() {
  var deferred = Q.defer();
  var self = this;
  function unregistered() {
    self._ua.off('unregistered', unregistered);
    self._registered = false;
    self.emit('unregistered', self);
    deferred.resolve(self);
    // NOTE(mroberts): Not sure about starting/stopping.
    // self._ua.stop();
  }
  self._ua.once('unregistered', unregistered);

  var capabilityToken = this.token;

  var deviceInfo = { 'p': 'browser' };
  var unregisterHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken);

  self._ua.unregister({
    'extraHeaders': unregisterHeaders
  });
  return deferred.promise;
};

function setupUAListeners(userAgent, ua) {
  var self = userAgent;
  ua.on('invite', function(session) {
    var request = session.request;
    var to = userAgent;
    var from = request.from.uri;
    var sid = request.getHeader('X-Twilio-CallSid');
    var inviteServerTransaction = new SIPJSInviteServerTransaction(to, from, sid, session);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  return this;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
