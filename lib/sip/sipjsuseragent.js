'use strict';

require('../webrtc/mock');

var inherits = require('util').inherits;
var Q = require('q');
var SIPJS = require('sip.js');
var SIPJSDialog = require('./sipjsdialog.js');
var UserAgent = require('./UserAgent');

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @classdesc
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @extends {UserAgent}
 * @param {Participant} participant
 * @param {?object} options
 * @property {Participant} participant
 */
function SIPJSUserAgent(participant, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJsUserAgent(participant, options);
  }
  UserAgent.call(this);

  options = options || {};
  var defaults = {
    'debug': true,
    'wsServer': 'ws://global.vss.twilio.com:5082'
  };
  for (var option in defaults) {
    if (!(option in options)) {
      options[option] = defaults[option];
    }
  }
  var debug = options['debug'];
  var wsServer = options['wsServer'];

  var UA = options['uaFactory'] || SIPJS.UA;
  var ua = new UA({
    'autostart': false,
    'register': false,
    'traceSip': debug,
    'stunServers': 'invalid',
    // 'wsServers': [wsServer, wsServer],
    'wsServers': wsServer,
    'log': {
      'builtinEnabled': debug
    }
  });

  Object.defineProperties(this, {
    _ua: {
      value: ua
    }
  });

  ua.start();

  return Object.freeze(this);
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype.invite = function invite(session, participant) {
  var self = this;
  var deferred = Q.defer();

  function go() {
    var target = participant.address;
    var sipjsSession = self._ua.invite(target, {
      // 'extraHeaders': inviteHeaders,
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

SIPJSUserAgent.prototype.hangup = function hangup() {
  var args = [].slice.call(arguments);
  switch (args.length) {
    case 1:
      return hangupDialog(this, args[0]);
    case 2:
      return this._hangupBySessionAndParticipant(this, args[0], args[1]);
  }
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

module.exports = SIPJSUserAgent;
