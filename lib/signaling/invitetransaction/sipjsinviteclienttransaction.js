'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var InviteClientTransaction = require('./inviteclienttransaction');
var Q = require('q');
var SIPJSDialog = require('../sipjsdialog');
var Stream = require('../../media/stream');
var util = require('../../util');

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
  options = util.withDefaults(options, {
    'iceServers': [],
    'localStream': null,
    'localStreamConstraints': null
  });
  InviteClientTransaction.call(this, userAgent);

  var session = null;

  // Get a Stream, if necessary, then ask SIP.js to place an INVITE. If the
  // outgoing Session is accepted, resolve the promise with a SIPJSDialog.
  var stream = options['localStream']
             ? new Q(options['localStream'])
             : Stream.getUserMedia(options['localStreamConstraints']);
  stream.then(function(localStream) {
    self._stream = localStream;
    var token = userAgent.token;
    var target = 'sip:' + to + '@' + token.accountSid + '.twil.io';
    var deviceInfo = { 'p': 'browser' };
    var inviteHeaders = util.makeInviteHeaders(deviceInfo, token, {});

    // TODO(mroberts): This is duplicated in sipjsuseragent.js; it should really
    // be in util or something.
    var iceServers = options['iceServers'];
    var stunServers = util.getStunServers(iceServers);
    var turnServers = util.getTurnServers(iceServers);

    session = userAgent._ua.invite(target, {
      'extraHeaders': inviteHeaders,
      'inviteWithoutSdp': options['inviteWithoutSdp'],
      'media': {
        'stream': localStream.mediaStream
      },
      'stunServers': stunServers,
      'turnServers': turnServers
    });

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
      var remoteStream = new Stream(session.getRemoteStreams()[0]);
      var peerConnection = session.mediaHandler.peerConnection;
      var inviteTo180 = _180Time ? _180Time - inviteTime : null;
      var conversationSid = util.parseConversationSIDFromContactHeader(
        response.getHeader('Contact'));
      var dialog = new SIPJSDialog(userAgent, to, conversationSid, callSid, localStream, remoteStream, self.iceServers, peerConnection, session, inviteTo180, conversationSid);
      self._deferred.resolve(dialog);
    });
    session.once('rejected', function() {
      self._rejected = true;
      self._deferred.reject(self);
    });
    session.once('failed', function() {
      if (!self.accepted || !self.canceled) {
        self._failed = true;
        self._deferred.reject(self);
      }
    });
  }).then(null, function(error) {
    self._failed = true;
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

SIPJSInviteClientTransaction.prototype.cancel = function cancel() {
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
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
