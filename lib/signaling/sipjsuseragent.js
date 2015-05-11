'use strict';

var constants = require('../util/constants');
var headers = constants.headers;
var inherits = require('util').inherits;
var Q = require('q');
var Conversation = require('../conversation');
var ScopedAuthenticationToken = require('../scopedauthenticationtoken');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var SIPJSInviteClientTransaction = require('./invitetransaction/sipjsinviteclienttransaction.js');
var SIPJSInviteServerTransaction = require('./invitetransaction/sipjsinviteservertransaction');
var Stream = require('../media/stream');
var UserAgent = require('./useragent');
var util = require('../util');
var E = constants.twilioErrors;

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @class
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {(string|ScopedAuthenticationToken)} token
 * @param {object} [options]
 * @augments {UserAgent}
 */
function SIPJSUserAgent(token, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(token, options);
  }

  var accountSid = token.accountSid;
  var address = token.address;
  var uri = address + '@' + constants.REGISTRAR_SERVER(accountSid);

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'iceServers': [],
    'inviteClientTransactionFactory': SIPJSInviteClientTransaction,
    'registrarServer': constants['REGISTRAR_SERVER'](accountSid),
    'wsServer': constants['WS_SERVER'](accountSid),
    'uaFactory': SIPJS.UA
  });

  // Setup the SIP.js UA.
  var iceServers = options['iceServers'];
  var useWssHack = /^wss:\/\//.test(options['wsServer']);
  var ua = setupUA.call(this, new options['uaFactory']({
    'autostart': false,
    'log': {
      'builtinEnabled': options['debug']
    },
    'register': false,
    'registrarServer': options['registrarServer'],
    'stunServers': util.getStunServers(iceServers),
    'traceSip': options['debug'],
    'turnServers': util.getTurnServers(iceServers),
    'uri': uri,
    'wsServers': options['wsServer'],
    'hackWssInTransport': useWssHack
  }));

  Object.defineProperties(this, {
    '_ua': {
      value: ua
    }
  });

  UserAgent.call(this, token, options);

  return Object.freeze(this);
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype._register = function _register(token) {
  var self = this;

  function register() {
    var registerHeaders = util.makeRegisterHeaders(token);
    self._ua.register({ 'extraHeaders': registerHeaders });
  }

  return this.connect().then(function() {
    return util.promiseFromEvents(register, self._ua, 'registered', 'registrationFailed');
  });

};

SIPJSUserAgent.prototype._unregister = function _unregister() {
  var self = this;
  var token = self.token;

  function unregister() {
    var unregisterHeaders = util.makeRegisterHeaders(token);
    self._ua.unregister({ 'extraHeaders': unregisterHeaders });
  }

  return this.connect().then(function() {
    return util.promiseFromEvents(unregister, self._ua, 'unregistered');
  });
};

SIPJSUserAgent.prototype._connect = function _connect() {
  var self = this;
  function startUA() {
    self._ua.start();
  }

  return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected');
};

SIPJSUserAgent.prototype._disconnect = function _disconnect() {
  var self = this;
  function stopUA() {
    self._ua.stop();
  }

  return util.promiseFromEvents(stopUA, this._ua, 'disconnected');
};

function setupUA(ua) {
  /* jshint validthis:true */
  var self = this;
  ua.on('invite', function(session) {
    var request = session.request;
    var to = self;
    var from = request.from.uri.user;
    var callSid = request.getHeader('X-Twilio-CallSid');
    var conversationSid = util.parseConversationSIDFromContactHeader(
      request.getHeader('Contact'));
    var inviteServerTransaction = new SIPJSInviteServerTransaction(to, from, conversationSid, callSid, session);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  return ua;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
