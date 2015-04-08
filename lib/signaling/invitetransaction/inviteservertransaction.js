'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');

/**
 * Construct an {@link InviteServerTransaction}.
 * @class
 * @classdesc An {@link InviteServerTransaction} is an
 *   {@link InviteTransaction} addressed to a {@link UserAgent}.
 * @param {UserAgent} userAgent - the recipient of the
 *   {@link InviteServerTransaction}
 * @param {string} from - the sender of the {@link InviteServerTransaction}
 * @param {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID, if accepted
 * @param {string} callSid - the {@link Dialog}'s call SID, if accepted
 * @property {string} from - the sender of the {@link InviteServerTransaction}
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID, if accepted
 * @property {string} callSid - the {@link Dialog}'s call SID, if accepted
 * @augments InviteTransaction
 */
function InviteServerTransaction(userAgent, from, conversationSid, callSid) {
  InviteTransaction.call(this, userAgent);
  Object.defineProperties(this, {
    'callSid': {
      enumerable: true,
      value: callSid
    },
    'conversationSid': {
      enumerable: true,
      value: conversationSid
    },
    'from': {
      enumerable: true,
      value: from
    }
  });
  return this;
}

inherits(InviteServerTransaction, InviteTransaction);

/**
 * Accept the {@link InviteServerTransaction}
 * @instance
 * @param {object} [options]
 * @fires InviteTransaction#accepted
 * @returns {Promise<InviteServerTransaction>}
 */
InviteServerTransaction.prototype.accept = function accept(options) {
  var self = this;
  options = util.withDefaults(options, {
    'iceServers': this.userAgent.iceServers,
    'stream': null,
    'streamConstraints': null
  });
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._accepted = true;
    // FIXME(mroberts): This is fine for testing, but not really what we want.
    self._deferred.resolve(self.dialog);
  });
  return this.then(function() {
    InviteTransaction._checkInviteTransactionState(self);
    return self;
  }, function(self) {
    throw self;
  });
};

/**
 * Reject the {@link InviteServerTransaction}.
 * @instance
 * @fires InviteTransaction#rejected
 * @returns {Promise<InviteServerTransaction>}
 */
InviteServerTransaction.prototype.reject = function reject() {
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._rejected = true;
    self._deferred.reject(self);
  });
  return this.then(function() {
    InviteTransaction._checkInviteTransactionState(self);
  }, function(self) {
    throw self;
  });
};

module.exports = InviteServerTransaction;
