'use strict';

var constants = require('../util/constants');
var headers = constants.headers;
var inherits = require('util').inherits;
var Q = require('q');
var Conversation = require('../conversation');
var AccessToken = require('../accesstoken');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var SIPJSInviteClientTransaction = require('./invitetransaction/sipjsinviteclienttransaction.js');
var SIPJSInviteServerTransaction = require('./invitetransaction/sipjsinviteservertransaction');
var UserAgent = require('./useragent');
var util = require('../util');
var E = constants.twilioErrors;

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @class
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {(AccessToken|string)} token
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
    'inviteClientTransactionFactory': SIPJSInviteClientTransaction,
    'registrarServer': constants['REGISTRAR_SERVER'](accountSid),
    'wsServer': constants['WS_SERVER'](accountSid),
    'uaFactory': SIPJS.UA
  });

  // Setup the SIP.js UA.
  var useWssHack = /^wss:\/\//.test(options['wsServer']);
  var ua = setupUA.call(this, new options['uaFactory']({
    'autostart': false,
    'log': {
      'builtinEnabled': options['debug']
    },
    'register': false,
    'registrarServer': options['registrarServer'],
    'traceSip': options['debug'],
    'uri': uri,
    'wsServers': options['wsServer'],
    'hackWssInTransport': useWssHack
  }));

  var stunServers = [];
  var turnServers = [];

  Object.defineProperties(this, {
    '_ua': {
      value: ua
    },
    '_stunServers': {
      set: function(_stunServers) {
        stunServers = _stunServers;
        util.overwriteArray(ua.configuration.stunServers, stunServers);
      }
    },
    '_turnServers': {
      set: function(_turnServers) {
        turnServers = _turnServers;
        util.overwriteArray(ua.configuration.turnServers, turnServers);
      }
    },
    'stunServers': {
      enumerable: true,
      get: function() {
        return stunServers;
      }
    },
    'turnServers': {
      enumerable: true,
      get: function() {
        return turnServers;
      }
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
  this._ua.stop();
  this._ua.transport.disconnect();

  var deferred = Q.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

function setupUA(ua) {
  /* jshint validthis:true */
  var self = this;
  ua.on('invite', function(session) {
    var inviteServerTransaction = new SIPJSInviteServerTransaction(self, session);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  return ua;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;
