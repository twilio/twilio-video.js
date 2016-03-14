'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./invitetransaction');

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
 * @param {string} participantSid - the {@link Participant} SID
 * @param {string} cookie - the cookie, for joining the {@link InviteServerTransaction}
 *   to the corresponding {@link InviteClientTransaction}
 * @property {string} from - the sender of the {@link InviteServerTransaction}
 * @property {string} callSid - the {@link Dialog}'s call SID, if accepted
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID, if accepted
 * @param {string} cookie - the cookie, for joining the {@link InviteServerTransaction}
 *   to the corresponding {@link InviteClientTransaction}
 * @param {string} from - the sender of the {@link InviteServerTransaction}
 * @param {string} key - a key for joining the {@link InviteServerTransaction} to
 *   corresponding {@link InviteServerTransaction}s
 * @param {string} participantSid - the {@link Participant} SID
 * @augments InviteTransaction
 */
function InviteServerTransaction(userAgent, from, conversationSid, callSid, participantSid, cookie) {
  InviteTransaction.call(this, userAgent);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    callSid: {
      enumerable: true,
      value: callSid
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    cookie: {
      enumerable: true,
      value: cookie
    },
    from: {
      enumerable: true,
      value: from
    },
    key: {
      enumerable: true,
      value: conversationSid + ' ' + participantSid
    },
    participantSid: {
      value: participantSid
    }
  });
  return this;
}

inherits(InviteServerTransaction, InviteTransaction);

/**
 * Accept the {@link InviteServerTransaction}
 * @param {object} [options]
 * @fires InviteTransaction#accepted
 * @returns {Promise}
 */
InviteServerTransaction.prototype.accept = function accept() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self._setAccepted()) {
      self._deferred.resolve(self.dialog);
      resolve();
    } else {
      reject(new Error('InviteServerTransaction already in state: ' + self._state));
    }
  });
};

/**
 * Reject the {@link InviteServerTransaction}.
 * @fires InviteTransaction#rejected
 * @returns {this}
 */
InviteServerTransaction.prototype.reject = function reject() {
  if (!this._setRejected()) {
    throw new Error('InviteServerTransaction already in state: ' + this._state);
  }
  this._deferred.reject(this);
  return this;
};

module.exports = InviteServerTransaction;
