'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');

/**
 * Construct an {@link InviteServerTransaction}.
 * @class
 * @classdesc An {@link InviteServerTransaction} is an
 * {@link InviteTransaction} addressed to a {@link UserAgent}.
 * @param {UserAgent} to - the recipient of the {@link InviteServerTransaction}
 * @param {string} from - the sender of the {@link InviteServerTransaction}
 * @param {string} sid - the {@link Dialog}'s SID, if accepted
 * @param {object} [options]
 * @property {string} from - the sender of the {@link InviteServerTransaction}
 * @property {string} sid - the {@link Dialog}'s SID, if accepted
 * @property {UserAgent} to - the recipient of the {@link InviteServerTransaction}
 * @augments InviteTransaction
 */
function InviteServerTransaction(to, from, sid, options) {
  InviteTransaction.call(this, to, from, options);
  Object.defineProperties(this, {
    'sid': {
      value: sid
    }
  });
  return this;
}

inherits(InviteServerTransaction, InviteTransaction);

/**
 * Accept the {@link InviteServerTransaction}
 * @instance
 * @fires InviteTransaction#accepted
 * @returns {Promise<Dialog>}
 */
InviteServerTransaction.prototype.accept = function accept(options) {
  options = options || {};
  this._iceServers = options['iceServers'] || this.iceServers;
  var self = this;
  setTimeout(function() {
    try {
      InviteTransaction._checkInviteTransactionState(self);
    } catch (e) {
      return;
    }
    self._accepted = true;
    self._deferred.resolve(self.dialog);
  });
  return this.then(function() {
    InviteTransaction._checkInviteTransactionState(self);
  }, function(self) {
    return self;
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
    return self;
  });
};

module.exports = InviteServerTransaction;
