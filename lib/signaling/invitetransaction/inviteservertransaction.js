'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');

/**
 * Construct an {@link InviteServerTransaction}.
 * @class
 * @classdesc An {@link InviteServerTransaction} is an
 * {@link InviteTransaction} addressed to a {@link UserAgent}.
 * @param {UserAgent} to
 * @param {string} from
 * @property {string} from
 * @property {UserAgent} to
 * @augments InviteTransaction
 */
function InviteServerTransaction(to, from) {
  if (!(this instanceof InviteServerTransaction)) {
    return new InviteServerTransaction(to, from);
  }
  InviteTransaction.call(this, to, from);
  return Object.freeze(this);
}

inherits(InviteServerTransaction, InviteTransaction);

/**
 * Accept the {@link InviteServerTransaction}
 * @instance
 * @returns Promise<Dialog>
 * @fires InviteTransaction#accepted
 */
InviteServerTransaction.prototype.accept = function accept() {
  checkInviteTransactionState(this);
  this._accepted = true;
  this._deferred.resolve(this.dialog);
  var self = this;
  return this._promise;
};

/**
 * Reject the {@link InviteServerTransaction}.
 * @instance
 * @returns Promise<InviteServerTransaction>
 * @fires InviteTransaction#rejected
 */
InviteServerTransaction.prototype.reject = function reject() {
  checkInviteTransactionState(this);
  this._rejected = true;
  this._deferred.reject(this);
  return this._promise.then(null, function(self) {
    return self;
  });
};

Object.freeze(InviteServerTransaction.prototype);

module.exports = InviteServerTransaction;
