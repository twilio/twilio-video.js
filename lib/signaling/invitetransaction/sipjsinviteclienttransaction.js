'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var InviteClientTransaction = require('./inviteclienttransaction');
var Q = require('q');
var C = require('../../util/constants');
var SIPJSDialog = require('../sipjsdialog');
var headers = require('../../util/constants').headers;
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = require('../../media/localmedia');

/**
 * Construct a {@link SIPJSInviteClientTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteClientTransaction} is an
 *   {@link InviteClientTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the sender of the
 *   {@link SIPJSInviteClientTransaction}
 * @param {Array<string>} to - the recipient(s) of the
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

  var callTimeout = options.callTimeout || C.DEFAULT_CALL_TIMEOUT;
  var ignoreTimeout = null;
  var isMultiInvite = to.length > 1;
  var isRejected = false;
  var session = null;

  // Get LocalMedia, if necessary, then ask SIP.js to place an INVITE. If the
  // outgoing Session is accepted, resolve the promise with a SIPJSDialog.
  userAgent.connect().then(function() {
    return LocalMedia.getLocalMedia(options);
  }).then(function(localMedia) {
    self._media = localMedia;

    if(self.isCanceled) {
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
      var remoteMedia = new Media();
      session.mediaHandler.on('addStream', function addStream(event) {
        remoteMedia._addStream(event.stream);
      });
      var inviteTo180 = _180Time ? _180Time - inviteTime : null;
      var conversationSid = util.parseConversationSIDFromContactHeader(
        response.getHeader('Contact'));
      var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
      participantInfo = participantInfo ? participantInfo.split(';') : null;
      var participantSid = participantInfo ? participantInfo[0] : null;
      var dialog = new SIPJSDialog(userAgent, to[0], conversationSid, callSid, localMedia, remoteMedia, peerConnection, participantSid, session, inviteTo180);
      clearTimeout(ignoreTimeout);
      self._deferred.resolve(dialog);
    });

    session.once('rejected', function(res) {
      clearTimeout(ignoreTimeout);

      if(isMultiInvite) {
        isRejected = true;
        return;
      }

      if (res && res['status_code'] === 600 && self._setRejected()) {
        self._deferred.reject(new Error('rejected'));
      } else if (self._setFailed()) {
        self._deferred.reject(new Error('failed'));
      }
    });

    session.once('failed', function() {
      if(isRejected) { return; }

      clearTimeout(ignoreTimeout);
      if (self._setFailed()) {
        self._deferred.reject(new Error('failed'));
      }
    });
  }).then(null, function(error) {
    clearTimeout(ignoreTimeout);
    if (self._setFailed()) {
      self._deferred.reject(error);
    }
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cookie: {
      value: options.cookie
    },
    _ignoreTimeout: {
      get: function() {
        return ignoreTimeout;
      }
    },
    session: {
      enumerable: true,
      get: function() {
        return session;
      }
    }
  });

  return this;
}

inherits(SIPJSInviteClientTransaction, InviteClientTransaction);

function startSession(userAgent, to, options, localMedia) {
  var token = userAgent.accessManager.token;

  var participants = to.slice();
  var target = participants.shift();

  var extraHeaders = [
    util.selectTokenHeader(token)    + ': ' + token,
    C.headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];

  if(participants.length) {
    var participantsHeader = participants.join(',') + ';cookie=' + options.cookie;
    extraHeaders.push(C.headers.X_TWILIO_PARTICIPANTS + ': ' + participantsHeader);
  }

  extraHeaders.push('Session-Expires: 120');

  var mediaStreams = [];
  localMedia.mediaStreams.forEach(function(mediaStream) {
    mediaStreams.push(mediaStream);
  });

  return userAgent._ua.invite(target, {
    extraHeaders: extraHeaders,
    inviteWithoutSdp: options.inviteWithoutSdp,
    media: { stream: mediaStreams[0] },
    RTCConstraints: C.DEFAULT_OFFER_OPTIONS,
    stunServers: options.stunServers,
    turnServers: options.turnServers
  });
}

SIPJSInviteClientTransaction.prototype.cancel = function cancel() {
  var self = this;
  var session = self.session;

  clearTimeout(this._ignoreTimeout);

  var setCanceled = new Promise(function(resolve, reject) {
    if(self._setCanceled()) {
      self._deferred.reject(self);
      resolve(self);
    } else {
      reject(new Error('SIPJSInviteClientTransaction already in state: ' + self._state));
    }
  });

  if (session) {
    var cancelSession = util.promiseFromEvents(session.cancel.bind(session), session, 'cancel', 'accepted');
    return cancelSession.then(setCanceled);
  } else {
    return setCanceled;
  }
};

Object.freeze(SIPJSInviteClientTransaction.prototype);

module.exports = SIPJSInviteClientTransaction;
