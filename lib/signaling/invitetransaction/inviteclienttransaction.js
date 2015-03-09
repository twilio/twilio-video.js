'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var Q = require('q');

/**
 * Construct an {@link InviteClientTransaction}.
 * @class
 * @classdesc An {@link InviteClientTransaction} is an
 * {@link InviteTransaction} addressed from a {@link UserAgent}.
 * @param {UserAgent} from - the sender of the
 *   {@link InviteClientTransaction}
 * @param {string} to - the recipient of the {@link InviteClientTransaction}
 * @param {object} [options]
 * @property {UserAgent} from - the sender of the
 *   {@link InviteClientTransaction}
 * @property {string} to - the recipient of the {@link InviteClientTransaction}
 * @augments InviteTransaction
 */
function InviteClientTransaction(from, to, options) {
  InviteTransaction.call(this, to, from, options);
}

inherits(InviteClientTransaction, InviteTransaction);

/**
 * Cancel the {@link InviteClientTransaction}.
 * @instance
 * @fires InviteTransaction#canceled
 * @returns {Promise<InviteClientTransaction>}
 */
InviteClientTransaction.prototype.cancel = function cancel() {
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._canceled = true;
    self._deferred.reject(self);
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

module.exports = InviteClientTransaction;
