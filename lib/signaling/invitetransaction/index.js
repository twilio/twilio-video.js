'use strict';

var Q = require('q');

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct an {@link InviteTransaction}.
 * @class
 * @classdesc An {@link InviteTransaction} is a Promise for a {@link Dialog}.
 * @param {(RemoteEndpoint|UserAgent)} to - the recipient of the
 *   {@link InviteTransaction}
 * @param {(RemoteEndpoint|UserAgent)} from - the sender of the
 *   {@link InviteTransaction}
 * @property {?Dialog} dialog - the resulting {@link Dialog} when and if this
 *   {@link InviteTransaction} succeeds
 * @property {boolean} accepted - whether the {@link InviteTransaction}
 *   was accepted
 * @property {boolean} canceled - whether the {@link InviteTransaction}
 *   was canceled
 * @property {boolean} failed - whether the {@link InviteTransaction}
 *   failed
 * @property {(string|UserAgent)} from
 * @property {boolean} rejected - whether the {@link InviteTransaction}
 *   was rejected
 * @property {(string|UserAgent)} to
 * @augments Promise
 * @fires InviteTransaction#accepted
 * @fires InviteTransaction#canceled
 * @fires InviteTransaction#failed
 * @fires InviteTransaction#rejected
 */
function InviteTransaction(to, from) {
  var self = this;
  EventEmitter.call(this);

  var accepted = false;
  var canceled = false;
  var failed = false;
  var rejected = false;

  var dialog = null;

  var deferred = Q.defer();

  // All of the logic for finalizing the InviteTransaction and emitting the
  // events lives in the Promise. Accepting, canceling, and rejecting merely
  // reject or resolve the promise, thereby triggering the following logic.
  //
  // This is also how subclasses extend InviteTransaction: for example, if the
  // signaling channel receives a cancel or reject, it updates its state and
  // rejects the Promise.
  var promise = deferred.promise.then(function(_dialog) {
    self._accepted = true;
    dialog = _dialog;
    self.emit('accepted', dialog);
    return dialog;
  }, function(reason) {
    if (reason === self) {
      switch (true) {
        case self.canceled: self.emit('canceled', self); break;
        case self.rejected: self.emit('rejected', self); break;
      }
      throw self;
    }
    self._failed = true;
    self.emit('failed', reason);
    throw reason;
  });

  Object.defineProperties(this, {
    '_accepted': {
      set: function(_accepted) {
        accepted = _accepted;
      }
    },
    '_canceled': {
      set: function(_canceled) {
        canceled = _canceled;
      }
    },
    '_deferred': {
      value: deferred
    },
    '_failed': {
      set: function(_failed) {
        failed = _failed;
      }
    },
    '_promise': {
      value: promise
    },
    '_rejected': {
      set: function(_rejected) {
        rejected = _rejected;
      }
    },
    'accepted': {
      enumerable: true,
      get: function() {
        return accepted;
      }
    },
    'canceled': {
      enumerable: true,
      get: function() {
        return canceled;
      }
    }
    'dialog': {
      enumerable: true,
      get: function() {
        return dialog;
      }
    },
    'failed': {
      enumerable: true,
      get: function() {
        return failed;
      }
    },
    'from': {
      enumerable: true,
      value: from
    },
    'rejected': {
      enumerable: true,
      get: function() {
        return rejected;
      }
    },
    'to': {
      enumerable: true,
      value: to
    }
  });
  return this;
}

inherits(InviteTransaction, EventEmitter);

InviteTransaction._checkInviteTransactionState = function checkInviteTransactionState(inviteTransaction) {
  if (inviteTransaction.accepted) {
    throw new Error('InviteTransaction already accepted');
  } else if (inviteTransaction.canceled) {
    throw new Error('InviteTransaction already canceled');
  } else if (inviteTransaction.rejected) {
    throw new Error('InviteTransaction already rejected');
  } else if (inviteTransaction.failed) {
    throw new Error('InviteTransaction failed');
  }
}

InviteTransaction.prototype.then = function(onResolve, onReject) {
  return this._promise.then(onResolve, onReject);
};

Object.freeze(InviteTransaction.prototype);

module.exports = InviteTransaction;
