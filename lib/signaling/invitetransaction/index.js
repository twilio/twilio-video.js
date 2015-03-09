'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../../util');
var Q = require('q');

/**
 * Construct an {@link InviteTransaction}.
 * @class
 * @classdesc An {@link InviteTransaction} is a Promise for a {@link Dialog}.
 * @param {(RemoteEndpoint|UserAgent)} to - the recipient of the
 *   {@link InviteTransaction}
 * @param {(RemoteEndpoint|UserAgent)} from - the sender of the
 *   {@link InviteTransaction}
 * @param {object} [options]
 * @property {?Dialog} dialog - the resulting {@link Dialog} when and if this
 *   {@link InviteTransaction} succeeds
 * @property {boolean} accepted - whether the {@link InviteTransaction}
 *   was accepted
 * @property {boolean} canceled - whether the {@link InviteTransaction}
 *   was canceled
 * @property {boolean} failed - whether the {@link InviteTransaction}
 *   failed
 * @property {(string|UserAgent)} from - the sender of the
 *   {@link InviteTransaction}
 * @property {Promise<Dialog>} promise - a Promise for a {@link Dialog} that
 *   resolves if the {@link InviteTransaction} is accepted
 * @property {boolean} rejected - whether the {@link InviteTransaction}
 *   was rejected
 * @property {(string|UserAgent)} to - the recipient of the
 *   {@link InviteTransaction}
 * @property {Array<object>} [iceServers=[]] - the iceServers to use, if any
 * @augments Promise
 * @fires InviteTransaction#accepted
 * @fires InviteTransaction#canceled
 * @fires InviteTransaction#failed
 * @fires InviteTransaction#rejected
 */
function InviteTransaction(to, from, options) {
  var self = this;
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    'iceServers': []
  });

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
    dialog = _dialog;
    setTimeout(function() { self.emit('accepted', dialog); });
    return dialog;
  }, function(reason) {
    if (reason === self) {
      switch (true) {
        case self.canceled: setTimeout(function() { self.emit('canceled', self); });break;
        case self.rejected: setTimeout(function() { self.emit('rejected', self); }); break;
        default: setTimeout(function() { self.emit('failed', self); }); break;
      }
      throw self;
    }
    // self._failed = true;
    setTimeout(function() { self.emit('failed', reason); });
    throw reason;
  });

  var iceServers = options['iceServers'];

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
    '_iceServers': {
      set: function(_iceServers) {
        iceServers = _iceServers;
      }
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
    },
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
    'iceServers': {
      enumerable: true,
      get: function() {
        return iceServers
      }
    },
    'promise': {
      value: promise
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
  return this.promise.then(onResolve, onReject);
};

Object.freeze(InviteTransaction.prototype);

module.exports = InviteTransaction;
