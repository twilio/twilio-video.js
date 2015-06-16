'use strict';

var E = require('../../util/constants').twilioErrors;
var headers = require('../../util/constants').headers;
var inherits = require('util').inherits;
var InviteServerTransaction = require('./inviteservertransaction');
var InviteTransaction = require('./');
var SIPJSDialog = require('../sipjsdialog');
var Q = require('q');
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = Media.LocalMedia;

/**
 * Construct a {@link SIPJSInviteServerTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteServerTransactions} is an
 *   {@link InviteServerTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the recipient of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} from - the sender of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} conversationSid - the {@link SIPJSDialog}'s {@link Conversation} SID, if accepted
 * @param {string} callSid - the {@link SIPJSDialog}'s call SID, if accepted
 * @param {object} session - the SIP.js Session object
 * @property {object} session the SIP.js Session object
 * @augments InviteServerTransaction
 */
function SIPJSInviteServerTransaction(userAgent, session) {
  if (!(this instanceof SIPJSInviteServerTransaction)) {
    return new SIPJSInviteServerTransaction(userAgent, session);
  }

  var request = session.request;
  var from = request.from.uri.user;
  var conversationSid = util.parseConversationSIDFromContactHeader(request.getHeader('Contact'));
  var callSid = request.getHeader(headers.X_TWILIO_CALLSID);

  var participantInfo = request.getHeader(headers.X_TWILIO_PARTICIPANTSID);
  participantInfo = participantInfo ? participantInfo.split(';') : null;
  var participantSid = participantInfo ? participantInfo[0] : null;

  var cookieRegex = /^cookie=([^\s]+)/i;
  var cookie = participantInfo
    && participantInfo[1]
    && cookieRegex.test(participantInfo[1])
    && participantInfo[1].match(cookieRegex)[1];

  InviteServerTransaction.call(this, userAgent, from, conversationSid, callSid, participantSid, cookie);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    'session': {
      enumerable: true,
      value: session
    }
  });

  var self = this;
  session.once('cancel', function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._canceled = true;

    var error = E.CONVERSATION_JOIN_FAILED.clone('Incoming Invite was canceled by the sender');
    self._deferred.reject(error);
  });
  session.once('failed', function(response) {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._failed = true;

    var message = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw') || 'An unknown error occurred';
    var error = E.CONVERSATION_JOIN_FAILED.clone(message);
    self._deferred.reject(error);
  });
  return Object.freeze(this);
}

inherits(SIPJSInviteServerTransaction, InviteServerTransaction);

SIPJSInviteServerTransaction.prototype.accept = function accept(options) {
  var self = this;
  InviteTransaction._checkInviteTransactionState(this);
  options = util.withDefaults(options, {
  });
  var getLocalMedia = LocalMedia.getLocalMedia(options);
  getLocalMedia.then(function(localMedia) {
    var mediaStreams = [];
    localMedia.mediaStreams.forEach(function(mediaStream) {
      mediaStreams.push(mediaStream);
    });
    options['media'] = options['media'] || {};
    options['media']['stream'] = mediaStreams[0];

    self.session.accept(options);
    self.session.once('accepted', function() {
      try {
        InviteTransaction._checkInviteTransactionState(self);
      } catch (e) {
        return;
      }

      var dialog = null;
      var peerConnection = self.session.mediaHandler.peerConnection;
      var remoteMedia = new Media(peerConnection);
      self.session.mediaHandler.on('addStream', function addStream(event) {
        if (event) {
          remoteMedia._addStream(event.stream);
        }
      });
      var remoteStreams = peerConnection.getRemoteStreams() || [];
      remoteStreams.forEach(remoteMedia._addStream, remoteMedia);

      // NOTE(mroberts): OK, here is the fun part: we need to check if there
      // was an offer; if so, we need to check if there is an answer. In the
      // INVITE without SDP case, we have to wait for the ACK. Unfortunately,
      // we don't have a great way of catching this event yet.
      if (!self.session.hasOffer) {
        dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localMedia, remoteMedia, peerConnection, self.session, null);
        self._accepted = true;
        self._deferred.resolve(dialog);
      } else if (self.session.hasOffer && self.session.hasAnswer) {
        // FIXME(mroberts): Not sure about this.
        dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localMedia, remoteMedia, peerConnection, self.session, null);
        self._accepted = true;
        self._deferred.resolve(dialog);
      } else if (self.session.hasOffer && !self.session.hasAnswer) {
        self.session.mediaHandler.once('addStream', function() {
          dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localMedia, remoteMedia, peerConnection, self.session, null);
          self._accepted = true;
          self._deferred.resolve(dialog);
        });
      }
    });
  });
  return this;
};

SIPJSInviteServerTransaction.prototype.reject = function reject() {
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self.session.once('rejected', function() {
      try {
        InviteTransaction._checkInviteTransactionState(self);
      } catch (e) {
        return;
      }
      self._rejected = true;
      self._deferred.reject(self);
    });
    self.session.reject();
  });
  return this.then(function() {
    InviteTransaction._checkInviteTransactionState(self);
  }, function(self) {
    if (self.rejected) {
      return self;
    }
    InviteTransaction._checkInviteTransactionState(self);
  });
};

Object.freeze(SIPJSInviteServerTransaction.prototype);

module.exports = SIPJSInviteServerTransaction;
