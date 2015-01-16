'use strict';

var headers = require('../util/constants').headers;
var inherits = require('util').inherits;
var Log = require('../util/log');
var Participant = require('../participant');
var Q = require('q');
var Session = require('../Session');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var UserAgent = require('./UserAgent');
var util = require('../util');

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @classdesc
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @extends {UserAgent}
 * @param {Endpoint} endpoint
 * @param {?object} options
 * @property {Endpoint} endpoint
 * @fires UserAgent#registered
 * @fires UserAgent#unregistered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#invite
 * @fires UserAgent#hangup
 */
function SIPJSUserAgent(endpoint, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(endpoint, options);
  }

  options = util.withDefaults(options, {
    'debug': false,
    'logLevel': Log.INFO,
    'registrarServer': 'chunder.twilio.com',
    'wsServer': 'ws://ec2-107-21-165-58.compute-1.amazonaws.com:5082'
  });

  var token = endpoint.token;
  var capabilityToken = token._capabilityToken;
  var stunTurnToken = token._stunTurnToken;

  var accountSid = token.accountSid;
  var address = endpoint.address;
  // var uri = util.makeURI(accountSid, address);
  var uri = address + '@twil.io';

  var deviceInfo = {'p': 'browser'};
  var extraHeaders =
    util.makeRegisterHeaders(deviceInfo, capabilityToken, stunTurnToken);

  var iceServers = stunTurnToken.ice_servers;
  var stunServerUrl = iceServers[0].url.split('?')[0];
  var turnServerUrl = iceServers[1].url.split('?')[0];
  var turnServerUsername = stunTurnToken.username;
  var turnServerPassword = stunTurnToken.password;
  var turnServerInfo = {
    urls: turnServerUrl,
    username: turnServerUsername,
    password: turnServerPassword
  };

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

  UserAgent.call(this, endpoint);

  setupUAListeners(this, ua);
  ua.start();

  return Object.freeze(this);
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype.invite = function invite(session, participant) {
  var self = this;
  var deferred = Q.defer();

  function go() {
    var target = participant.address;
    // target = 'sip:' + target + '@' + self.endpoint._token._capabilityToken.accountSid + '.chunder.twilio.com';
    target = 'sip:' + target + '@twil.io';
    var deviceInfo = {
      'p': 'browser'
    };
    var capabilityToken = self.endpoint._token._capabilityToken;
    var stunTurnToken = self.endpoint._token._stunTurnToken;
    var inviteHeaders = util.makeInviteHeaders(deviceInfo, capabilityToken, {}, stunTurnToken, session._uuid);
    var sipjsSession = self._ua.invite(target, {
      'extraHeaders': inviteHeaders,
      'media': {
        'constraints': {
          'audio': true,
          'video': true
        },
        'render': {}
      }
    });

    var dialog = new SIPJSDialog(self, session, participant, sipjsSession);

    sipjsSession.on('accepted', function() {
      self._dialogs.add(dialog);
      deferred.resolve(dialog);
    });

    sipjsSession.on('rejected', function() {
      deferred.reject(new Error('Participant "' + participant.address +
        '" rejected Session'));
    });

    sipjsSession.on('failed', function() {
      deferred.reject(new Error('Invite failed'));
    });
  }

  if (!this._ua.isConnected()) {
    this._ua.once('connected', go);
  } else {
    go();
  }

  return deferred.promise;
};

SIPJSUserAgent.prototype.register = function register() {
  var deferred = Q.defer();

  var capabilityToken = this.endpoint._token._capabilityToken;
  var stunTurnToken = this.endpoint._token._stunTurnToken;
  var deviceInfo = {
    'p': 'browser'
  };
  var registerHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken, stunTurnToken);

  var self = this;

  function registered(error) {
    self._ua.off('registered', this);
    self._ua.off('registrationFailed', this);
    if (error) {
      return deferred.reject(error);
    }
    self._registered = true;
    deferred.resolve(this);
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
    self._ua.off('unregister', this);
    self._registered = false;
    deferred.resolve(self);
    // self._ua.stop();
  }
  self._ua.once('unregistered', unregistered);

  var capabilityToken = this.endpoint._token._capabilityToken;
  var deviceInfo = {
    'p': 'browser'
  };
  var unregisterHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken);

  self._ua.unregister({
    'extraHeaders': unregisterHeaders
  });
  return deferred.promise;
};

SIPJSUserAgent.prototype.hangup = function hangup() {
  var args = [].slice.call(arguments);
  switch (args.length) {
    case 1:
      return hangupDialog(this, args[0]);
    case 2:
      return this._hangupBySessionAndParticipant(this, args[0], args[1]);
  }
};

SIPJSUserAgent.prototype.accept = function accept(dialog) {
  dialog._sipjsSession.accept();
  var session = dialog.session;
  session._joined(this.endpoint);
};

function hangupDialog(userAgent, dialog) {
  var deferred = Q.defer();
  setTimeout(function() {
    if (dialog.userAgent !== userAgent) {
      return deferred.reject(new Error(
        'UserAgent does not own the Dialog it is attempting to hangup'));
    } else if (!userAgent._dialogs.has(dialog)) {
      return deferred.reject(new Error(
        'Dialog is already hungup'));
    }
    dialog._sipjsSession.bye();
    userAgent._dialogs.delete(dialog);
    deferred.resolve(dialog);
  });
  return deferred.promise;
}

function setupUAListeners(userAgent, ua) {
  ua.on('invite', function(sipjsSession) {
    var request = sipjsSession.request;
    var remoteIdentity = sipjsSession.remoteIdentity;
    console.log(remoteIdentity);
    var from = remoteIdentity.uri.user;
    // console.log('\n\nFrom: ' + from + '\n\n');
    var sessionSid = request.getHeader(headers.X_TWILIO_SESSION);
    console.log(sessionSid);

    var participant = null;

    var session = Session._get(sessionSid);

    if (session) {
      var participants = session.participants;
      participants.forEach(function(_participant) {
        if (!from && _participant.address === from) {
          participant = _participant;
        }
      });
    } else {
      // TODO(mroberts): This is not really correct.
      // Participant.lookup(from);
      participant = new Participant(from);
      session = new Session(participant, userAgent.endpoint);
      participant.sessions.add(session);
    }

    var dialog = new SIPJSDialog(userAgent, session, participant, sipjsSession);
    userAgent._pending.add(dialog);

    sipjsSession.on('accepted', function() {
      userAgent._pending.delete(dialog);
      userAgent._dialogs.add(dialog);
    });

    sipjsSession.on('rejected', function() {
      userAgent._pending.delete(dialog);
    });

    sipjsSession.on('failed', function() {
      userAgent._pending.delete(dialog);
    });

    userAgent.emit('invite', session);
  });
  return this;
}

module.exports = SIPJSUserAgent;
