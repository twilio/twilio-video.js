'use strict';

var constants = require('../util/constants');
var headers = constants.headers;
var inherits = require('util').inherits;
var Log = require('../util/log');
var Participant = require('../participant');
var Q = require('q');
var Session = require('../session');
var Stream = require('../media/stream');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var UserAgent = require('./useragent');
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

  var token = endpoint.token;
  var accountSid = token.accountSid;

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'logLevel': Log.INFO,
    'registrarServer': accountSid + '.' + constants['REGISTRAR_SERVER'],
    'wsServer': constants['WS_SERVER'](accountSid)
  });

  var capabilityToken = token._capabilityToken;
  var stunTurnToken = token._stunTurnToken;

  var address = endpoint.address;
  // var uri = address + '@twil.io';
  var uri = address + '@' + accountSid + '.twil.io';

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

  function getUserMedia() {
    // TODO(mroberts): We really should be able to pass a Stream in.
    var constraints = { 'audio': true, 'video': true };
    Stream.getUserMedia(constraints)
      .done(inviteWithStream, function(error) {
        deferred.reject(error);
      });
  }

  function inviteWithStream(stream) {
    var target = participant.address;
    var token = self.endpoint._token;
    var accountSid = token.accountSid;
    // target = 'sip:' + target + '@' + self.endpoint._token._capabilityToken.accountSid + '.chunder.twilio.com';
    target = 'sip:' + target + '@' + accountSid + '.twil.io';
    var deviceInfo = {
      'p': 'browser'
    };
    var capabilityToken = token._capabilityToken;
    var stunTurnToken = token._stunTurnToken;
    var inviteHeaders = util.makeInviteHeaders(deviceInfo, capabilityToken, {}, stunTurnToken, session._uuid);
    window.stream = stream;
    var sipjsSession = self._ua.invite(target, {
      'extraHeaders': inviteHeaders,
      'media': {
        'stream': stream.mediaStream
      }
    });

    var dialog = new SIPJSDialog(self, session, participant, sipjsSession, stream);
    self._pending.add(dialog);
    self.endpoint.streams.set(session, [stream]);

    sipjsSession.once('accepted', function() {
      participant.streams.set(session, sipjsSession.getRemoteStreams().map(Stream));

      self._pending.delete(dialog);
      self._dialogs.add(dialog);
      session._joined(participant);
      deferred.resolve(dialog);
    });

    sipjsSession.once('rejected', function() {
      self._pending.delete(dialog);
      deferred.reject(new Error('Participant "' + participant.address +
        '" rejected Session'));
    });

    sipjsSession.once('failed', function() {
      self._pending.delete(dialog);
      deferred.reject(new Error('Invite failed'));
    });

    sipjsSession.once('bye', function() {
      self._pending.delete(dialog);
      self._dialogs.delete(dialog);
    });
  }

  if (!this._ua.isConnected()) {
    this._ua.once('connected', getUserMedia);
  } else {
    getUserMedia();
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
    deferred.resolve(self);
    // NOTE(mroberts): Not sure about starting/stopping.
    self._ua.stop();
  }
  self._ua.once('unregistered', unregistered);

  var capabilityToken = this.endpoint._token._capabilityToken;
  var stunTurnToken = this.endpoint._token._stunTurnToken;

  var deviceInfo = {
    'p': 'browser'
  };
  var unregisterHeaders = util.makeRegisterHeaders(deviceInfo, capabilityToken, stunTurnToken);

  self._ua.unregister({
    'extraHeaders': unregisterHeaders
  });
  return deferred.promise;
};

SIPJSUserAgent.prototype.hangup = function hangup() {
  var args = [].slice.call(arguments);
  switch (args.length) {
    case 1:
      return this._hangupDialog(args[0]);
    case 2:
      return this._hangupBySessionAndParticipant(args[0], args[1]);
  }
};

SIPJSUserAgent.prototype.accept = function accept(dialog, options) {
  var self = this;
  var deferred = Q.defer();

  Stream.getUserMedia()
    .done(acceptWithStream, deferred.reject);

  function acceptWithStream(stream) {
    self.endpoint.streams.set(dialog.session, [stream]);

    dialog._stream = stream;
    options = util.withDefaults({
      'media': {
        'stream': stream.mediaStream
      }
    });
    dialog._sipjsSession.accept(options);
    var session = dialog.session;

    session._joined(self.endpoint);

    dialog._sipjsSession.once('accepted', function() {
      deferred.resolve(session);
    });

    dialog._sipjsSession.once('rejected', function(error) {
      deferred.reject(new Error('Participant rejected Session'));
    });

    dialog._sipjsSession.once('failed', function(error) {
      deferred.reject(new Error('Accept failed'));
    });
  }

  return deferred.promise;
};

SIPJSUserAgent.prototype._hangupDialog = function _hangupDialog(dialog) {
  var userAgent = this;
  var deferred = Q.defer();
  setTimeout(function() {
    if (dialog.userAgent !== userAgent) {
      return deferred.reject(new Error(
        'UserAgent does not own the Dialog it is attempting to hangup'));
    } else if (!userAgent._dialogs.has(dialog)) {
      return deferred.reject(new Error(
        'Dialog is already hungup'));
    }
    try {
      dialog._sipjsSession.bye();
    } catch (e) {
      // Do nothing.
    }
    userAgent._dialogs.delete(dialog);
    deferred.resolve(dialog);
  });
  return deferred.promise;
}

function setupUAListeners(userAgent, ua) {
  ua.on('invite', function(sipjsSession) {
    var request = sipjsSession.request;
    var remoteIdentity = sipjsSession.remoteIdentity;
    var from = remoteIdentity.uri.user;
    var sessionSid = request.getHeader(headers.X_TWILIO_SESSION);

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
      session = new Session(participant, userAgent.endpoint, {
        'invite': false
      });
      participant.streams.set(session, sipjsSession.getRemoteStreams().map(Stream));
      session._participants.add(participant);
      participant.sessions.add(session);
    }

    var dialog = new SIPJSDialog(userAgent, session, participant, sipjsSession);
    userAgent._pending.add(dialog);

    sipjsSession.on('accepted', function() {
      userAgent._pending.delete(dialog);
      userAgent._dialogs.add(dialog);
      // TODO(mroberts): Cleanup this logic.
      userAgent.endpoint.sessions.add(session);
    });

    sipjsSession.on('rejected', function() {
      userAgent._pending.delete(dialog);
    });

    sipjsSession.on('failed', function() {
      userAgent._pending.delete(dialog);
    });

    sipjsSession.once('bye', function() {
      userAgent._pending.delete(dialog);
      userAgent._dialogs.delete(dialog);
    });

    userAgent.emit('invite', participant, session);
  });
  return this;
}

module.exports = SIPJSUserAgent;
