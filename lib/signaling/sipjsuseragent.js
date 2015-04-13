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
 * @class
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {(Token|string)} token
 * @param {object} [options]
 * @augments {UserAgent}
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

  var extraHeaders =
    util.makeRegisterHeaders(capabilityToken);

  var iceServers = options['iceServers'];
  var stunServers = util.getStunServers(iceServers);
  var turnServers = util.getTurnServers(iceServers);
  stunServers = stunServers.map(function(stunServer) {
    return stunServer['url'].split('?')[0];
  });
  turnServers = turnServers.map(function(turnServer) {
    var url = turnServer['url'].split('?')[0];
    var username = turnServer['username'];
    var password = turnServer['credential'];
    return {
      'urls': url,
      'username': username,
      'password': password
    };
  });

  var UA = options['uaFactory'] || SIPJS.UA;
  var ua = new UA({
    'autostart': false,
    'extraHeaders': extraHeaders,
    'log': {
      'builtinEnabled': options['debug']
    },
    'register': false,
    'registrarServer': options['registrarServer'],
    'stunServers': stunServers,
    'traceSip': options['debug'],
    'turnServers': turnServers,
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
  var self = this;
  token = !token ? this.token : typeof token === 'string' ? new Token(token) : token;
  var registerHeaders = util.makeRegisterHeaders(token);
  function register() {
    if (!self._ua.isConnected()) {
      return self._ua.once('connected', register);
    }
    self._ua.register({
      'extraHeaders': registerHeaders
    });
  }
  return util.promiseFromEvents(register, this._ua, 'registered', 'registrationFailed')
    .then(function() {
      self._registered = true;
      self._token = token;
      self.emit('registered');
    }, function(error) {
      self.emit('registrationFailed', error);
    });
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

  var unregisterHeaders = util.makeRegisterHeaders(capabilityToken);

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
    var from = request.from.uri.user;
    var callSid = request.getHeader('X-Twilio-CallSid');
    var conversationSid = request.getHeader('X-Twilio-ConversationSid');
    var inviteServerTransaction = new SIPJSInviteServerTransaction(to, from, conversationSid, callSid, session, conversationSid);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  return this;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
