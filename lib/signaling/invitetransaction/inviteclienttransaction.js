'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');

/**
 * Construct an {@link InviteClientTransaction}.
 * @class
 * @classdesc An {@link InviteClientTransaction} is an
 * {@link InviteTransaction} addressed from a {@link UserAgent}.
 * @param {UserAgent} from
 * @param {string} to
 * @property {UserAgent} from
 * @property {string} to
 * @augments InviteTransaction
 */
function InviteClientTransaction(from, to) {
  if (!(this instanceof InviteClientTransaction)) {
    return new InviteClientTransaction(from, to);
  }
  InviteTransaction.call(this, to, from);
  return Object.freeze(this);
}

inherits(InviteClientTransaction, InviteTransaction);

/**
 * Cancel the {@link InviteClientTransaction}.
 * @instance
 * @returns Promise<InviteClientTransaction>
 * @fires InviteTransaction#canceled
 */
InviteClientTransaction.prototype.cancel = function cancel() {
  InviteTransaction._checkInviteTransactionState(this);
  this._canceled = true;
  this._deferred.reject(this);
  return this._deferred.promise.then(null, function(self) {
    return self;
  });
};

Object.freeze(InviteClientTransaction.prototype);

module.exports = InviteClientTransaction;
