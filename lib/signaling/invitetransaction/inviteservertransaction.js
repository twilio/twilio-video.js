'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var util = require('../../util');

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
    participantSid: {
      value: participantSid
    },
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
    if(self._setAccepted()) {
      self._deferred.reject(self.dialog);
      resolve();
    } else {
      reject(new Error('InviteServerTransaction already in state: ' + self._state));
    }
  });
};

/**
 * Reject the {@link InviteServerTransaction}.
 * @fires InviteTransaction#rejected
 * @returns {Promise}
 */
InviteServerTransaction.prototype.reject = function reject() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if(self._setRejected()) {
      self._deferred.reject(self);
      resolve();
    } else {
      reject(new Error('InviteServerTransaction already in state: ' + self._state));
    }
  });
};

module.exports = InviteServerTransaction;
