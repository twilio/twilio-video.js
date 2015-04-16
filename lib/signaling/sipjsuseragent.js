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
 * @param {(string|Token)} token
 * @param {object} [options]
 * @augments {UserAgent}
 */
function SIPJSUserAgent(token, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(token, options);
  }

  token = new Token(token);
  var accountSid = token.accountSid;
  var address = token.incomingClientName;
  var uri = address + '@' + accountSid + '.twil.io';

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'iceServers': [],
    'inviteClientTransactionFactory': SIPJSInviteClientTransaction,
    'logLevel': Log.INFO,
    'registrarServer': constants['REGISTRAR_SERVER'](accountSid),
    'wsServer': constants['WS_SERVER'](accountSid),
    'uaFactory': SIPJS.UA
  });

  // Setup the SIP.js UA.
  var iceServers = options['iceServers'];
  var ua = setupUA.bind(this)(new options['uaFactory']({
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
    'wsServers': options['wsServer']
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
    if (!self._ua.isConnected()) {
      return self._ua.once('connected', register);
    }
    self._ua.register({
      'extraHeaders': registerHeaders
    });
  }
  return util.promiseFromEvents(register, this._ua, 'registered', 'registrationFailed');
}

SIPJSUserAgent.prototype._unregister = function _unregister() {
  var self = this;
  var token = self.token;
  function unregister() {
    var unregisterHeaders = util.makeRegisterHeaders(token);
    self._ua.unregister({
      'extraHeaders': unregisterHeaders
    });
  }
  return util.promiseFromEvents(unregister, this._ua, 'unregistered');
};

function setupUA(ua) {
  var self = this;
  ua.on('invite', function(session) {
    var request = session.request;
    var to = self;
    var from = request.from.uri.user;
    var callSid = request.getHeader('X-Twilio-CallSid');
    var conversationSid = util.parseConversationSIDFromContactHeader(
      request.getHeader('Contact'));
    var inviteServerTransaction = new SIPJSInviteServerTransaction(to, from, conversationSid, callSid, session, conversationSid);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  ua.start();
  return ua;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
