'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var InviteServerTransaction = require('./inviteservertransaction');
var Q = require('q');
var SIPJSDialog = require('../sipjsdialog');
var Stream = require('../../media/stream');
var util = require('../../util');

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
function SIPJSInviteServerTransaction(userAgent, from, conversationSid, callSid, session) {
  if (!(this instanceof SIPJSInviteServerTransaction)) {
    return new SIPJSInviteServerTransaction(userAgent, from, conversationSid, callSid, session);
  }
  InviteServerTransaction.call(this, userAgent, from, conversationSid, callSid);
  Object.defineProperties(this, {
    'session': {
      enumerable: true,
      value: session
    }
  });
  var self = this;
  session.once('cancel', function() {
    try {
      InviteTransaction._checkInviteTransactionState(this);
    } catch (e) {
      return;
    }
    self._canceled = true;
    self._deferred.reject(self);
  });
  session.once('failed', function() {
    try {
      InviteTransaction._checkInviteTransactionState(this);
    } catch (e) {
      return;
    }
    self._failed = true;
    self._deferred.reject(self);
  });
  return Object.freeze(this);
}

inherits(SIPJSInviteServerTransaction, InviteServerTransaction);

SIPJSInviteServerTransaction.prototype.accept = function accept(options) {
  var self = this;
  InviteTransaction._checkInviteTransactionState(this);
  options = util.withDefaults(options, {
    'iceServers': this.userAgent.iceServers,
    'localStream': null,
    'localStreamConstraints': null
  });
  var iceServers = options['iceServers'];
  var stream = options['localStream']
             ? Q(options['localStream'] instanceof Stream ? options['localStream'] : Stream(options['localStream']))
             : Stream.getUserMedia(options['localStreamConstraints']);
  stream.then(function(localStream) {
    options['media'] = options['media'] || {};
    options['media']['stream'] = localStream.mediaStream;

    // TODO(mroberts): This is duplicated in sipjsuseragent and should really
    // be its own function.
    // FIXME(mroberts): I'm pretty sure this option isn't even respected in the
    // InviteServerContext case.
    var iceServers = options['iceServers'];
    var stunServers = util.getStunServers(iceServers);
    var turnServers = util.getTurnServers(iceServers);

    options['stunServers'] = options['stunServers'] || stunServers;
    options['turnServers'] = options['turnServers'] || turnServers;
    self.session.accept(options);
    self.session.once('accepted', function() {
      try {
        InviteTransaction._checkInviteTransactionState(self);
      } catch (e) {
        return;
      }
      // NOTE(mroberts): OK, here is the fun part: we need to check if there
      // was an offer; if so, we need to check if there is an answer. In the
      // INVITE without SDP case, we have to wait for the ACK. Unfortunately,
      // we don't have a great way of catching this event yet.
      if (!self.session.hasOffer) {
        var remoteStream = null;
        var peerConnection = self.session.mediaHandler.peerConnection;
        var dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localStream, remoteStream, iceServers, peerConnection, self.session, null);
        self._accepted = true;
        self._deferred.resolve(dialog);
      } else if (self.session.hasOffer && self.session.hasAnswer) {
        // FIXME(mroberts): Not sure about this.
        var remoteStream = new Stream(self.session.getRemoteStreams()[0]);
        var peerConnection = self.session.mediaHandler.peerConnection;
        var dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localStream, remoteStream, iceServers, peerConnection, self.session, null);
        self._accepted = true;
        self._deferred.resolve(dialog);
      } else if (self.session.hasOffer && !self.session.hasAnswer) {
        self.session.mediaHandler.once('addStream', function() {
          var remoteStream = new Stream(self.session.getRemoteStreams()[0]);
          var peerConnection = self.session.mediaHandler.peerConnection;
          var dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localStream, remoteStream, iceServers, peerConnection, self.session, null);
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
