'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var InviteServerTransaction = require('./inviteservertransaction');
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
 * @param {string} sid - the {@link SIPJSDialog}'s SID, if accepted
 * @param {object} session - the SIP.js Session object
 * @property {object} session the SIP.js Session object
 * @augments InviteServerTransaction
 */
function SIPJSInviteServerTransaction(userAgent, from, sid, session) {
  if (!(this instanceof SIPJSInviteServerTransaction)) {
    return new SIPJSInviteServerTransaction(userAgent, from, sid, session);
  }
  InviteServerTransaction.call(this, userAgent, from, sid);
  Object.defineProperties(this, {
    'session': {
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
  options = util.withDefaults({
    'iceServers': []
  });
  var iceServers = options['iceServers'];
  var stream = options['stream']
             ? Q(options['stream'])
             : Stream.getUserMedia(options['streamConstraints']);
  stream.then(function(localStream) {
    options['media'] = options['media'] || {};
    options['media']['stream'] = localStream.mediaStream;
    self.session.accept(options);
    self.session.once('accepted', function() {
      try {
        InviteTransaction._checkInviteTransactionState(self);
      } catch (e) {
        return;
      }
      // FIXME(mroberts): Not sure about this.
      var remoteStream = new Stream(self.session.getRemoteStreams()[0]);
      var dialog = new SIPJSDialog(self.userAgent, self.from, self.sid, localStream, remoteStream, iceServers, self.session);
      self._accepted = true;
      self._deferred.resolve(dialog);
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
