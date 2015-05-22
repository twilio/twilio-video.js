'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var InviteClientTransaction = require('./inviteclienttransaction');
var Q = require('q');
var C = require('../../util/constants');
var SIPJSDialog = require('../sipjsdialog');
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = Media.LocalMedia;

/**
 * Construct a {@link SIPJSInviteClientTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteClientTransaction} is an
 *   {@link InviteClientTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the sender of the
 *   {@link SIPJSInviteClientTransaction}
 * @param {string} to - the recipient of the
 *   {@link SIPJSInviteClientTransaction}
 * @property {?object} session - the SIP.js Session object
 * @augments InviteClientTransaction
 */
function SIPJSInviteClientTransaction(userAgent, to, options) {
  if (!(this instanceof SIPJSInviteClientTransaction)) {
    return new SIPJSInviteClientTransaction(userAgent, to, options);
  }
  var self = this;

  InviteClientTransaction.call(this, userAgent);

  options = util.withDefaults(options, {
    'stunServers': userAgent.stunServers,
    'turnServers': userAgent.turnServers
  });

  to = to.forEach ? to : [to];

  var callTimeout = options.callTimeout || C.DEFAULT_CALL_TIMEOUT;
  var ignoreTimeout = null;
  var session = null;

  // Get LocalMedia, if necessary, then ask SIP.js to place an INVITE. If the
  // outgoing Session is accepted, resolve the promise with a SIPJSDialog.
  userAgent.connect().then(function() {
    return LocalMedia.getLocalMedia(options);
  }).then(function(localMedia) {
    self._media = localMedia;

    if(self.canceled) {
      return self._deferred.reject(new Error('canceled'));
    }

    session = startSession(userAgent, to, options, localMedia);

    ignoreTimeout = setTimeout(function() {
      self.cancel();
      self._deferred.reject(new Error('ignored'));
    }, callTimeout);

    var inviteTime = Date.now();
    var _180Time = null;
    session.on('progress', function(response) {
      if (response.statusCode === 180) {
        _180Time = Date.now();
      }
    });

    session.once('accepted', function(response) {
      var callSid = response.getHeader('X-Twilio-CallSid');
      // FIXME(mroberts): Not sure about this.
      var peerConnection = session.mediaHandler.peerConnection;
      var remoteMedia = new Media(peerConnection);
      session.mediaHandler.on('addStream', function addStream(event) {
        remoteMedia._addStream(event.stream);
      });
      var inviteTo180 = _180Time ? _180Time - inviteTime : null;
      var conversationSid = util.parseConversationSIDFromContactHeader(
        response.getHeader('Contact'));
      var dialog = new SIPJSDialog(userAgent, to[0], conversationSid, callSid, localMedia, remoteMedia, peerConnection, session, inviteTo180);
      clearTimeout(ignoreTimeout);
      self._deferred.resolve(dialog);
    });

    session.once('rejected', function() {
      self._rejected = true;
      clearTimeout(ignoreTimeout);
      self._deferred.reject(new Error('rejected'));
    });

    session.once('failed', function() {
      if (!self.accepted || !self.canceled) {
        self._failed = true;
        clearTimeout(ignoreTimeout);
        self._deferred.reject(new Error('failed'));
      }
    });
  }).then(null, function(error) {
    self._failed = true;
    if (ignoreTimeout) {
      clearTimeout(ignoreTimeout);
    }
    self._deferred.reject(error);
  });

  Object.defineProperties(this, {
    'session': {
      enumerable: true,
      get: function() {
        return session;
      }
    }
  });

  return Object.freeze(this);
}

inherits(SIPJSInviteClientTransaction, InviteClientTransaction);

function startSession(userAgent, to, options, localMedia) {
  var token = userAgent.token;

  var participants = to.map(function(address) {
    return 'sip:' + address + '@' + C.REGISTRAR_SERVER(token.accountSid);
  });

  var target = participants.shift();

  var extraHeaders = [
    C.headers.X_TWILIO_TOKEN         + ': ' + token.jwt,
    C.headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];

  if(participants.length) {
    var participantsHeader = participants.join(',') + ';cookie=' + options.cookie;
    extraHeaders.push(C.headers.X_TWILIO_PARTICIPANTS + ': ' + participantsHeader);
  }

  var mediaStreams = [];
  localMedia.mediaStreams.forEach(function(mediaStream) {
    mediaStreams.push(mediaStream);
  });

  return userAgent._ua.invite(target, {
    extraHeaders: extraHeaders,
    inviteWithoutSdp: options.inviteWithoutSdp,
    media: { stream: mediaStreams[0] },
    stunServers: options.stunServers,
    turnServers: options.turnServers
  });
}

SIPJSInviteClientTransaction.prototype.cancel = function cancel() {
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    if(self.session) {
      self.session.once('cancel', function() {
        try {
          InviteTransaction._checkInviteTransactionState(self);
        } catch (e) {
          return;
        }
        self._canceled = true;
        self._deferred.reject(self);
      });

      self.session.cancel();
    } else {
      self._canceled = true;
    }
  });
  return this.then(function() {
    InviteTransaction._checkInviteTransactionState(self);
  }, function(self) {
    if (self.canceled) {
      return self;
    }
    InviteTransaction._checkInviteTransactionState(self);
  });
};

Object.freeze(SIPJSInviteClientTransaction.prototype);

module.exports = SIPJSInviteClientTransaction;
