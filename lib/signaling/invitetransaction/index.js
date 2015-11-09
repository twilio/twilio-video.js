'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../../util');

// State Constants
var C = {
  STATE_PENDING: 'pending',
  STATE_ACCEPTED: 'accepted',
  STATE_REJECTED: 'rejected',
  STATE_CANCELED: 'canceled',
  STATE_FAILED: 'failed',
  FINAL_STATES: ['accepted', 'rejected', 'canceled', 'failed']
};

/**
 * Construct an {@link InviteTransaction}.
 * @class
 * @classdesc An {@link InviteTransaction} is a Promise for a {@link Dialog}.
 * @augments {Promise<Dialog>}
 * @param {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link InviteTransaction}
 * @property {?Dialog} dialog - the resulting {@link Dialog} when and if this
 *   {@link InviteTransaction} succeeds
 * @property {boolean} accepted - whether the {@link InviteTransaction}
 *   was accepted
 * @property {boolean} canceled - whether the {@link InviteTransaction}
 *   was canceled
 * @property {boolean} failed - whether the {@link InviteTransaction}
 *   failed
 * @property {boolean} rejected - whether the {@link InviteTransaction}
 *   was rejected
 * @property {(string|UserAgent)} userAgent - the {@link UserAgent} that owns
 *   this {@link InviteTransaction}
 * @fires InviteTransaction#accepted
 * @fires InviteTransaction#canceled
 * @fires InviteTransaction#failed
 * @fires InviteTransaction#rejected
 */
function InviteTransaction(userAgent) {
  var self = this;
  EventEmitter.call(this);

  var deferred = util.defer();
  var dialog = null;
  var state = C.STATE_PENDING;

  // All of the logic for finalizing the InviteTransaction and emitting the
  // events lives in the Promise. Accepting, canceling, and rejecting merely
  // reject or resolve the promise, thereby triggering the following logic.
  //
  // This is also how subclasses extend InviteTransaction: for example, if the
  // signaling channel receives a cancel or reject, it updates its state and
  // rejects the Promise.
  var promise = deferred.promise.then(function(_dialog) {
    dialog = _dialog;
    self.emit('accepted', dialog);

    return dialog;
  }, function(reason) {
    var event = state === C.STATE_PENDING ? 'failed' : state;
    self.emit(event, reason);
    throw reason;
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: deferred
    },
    _promise: {
      value: promise
    },
    _state: {
      set: function(_state) {
       state = _state;
     }
    },
    dialog: {
      enumerable: true,
      get: function() {
        return dialog;
      }
    },
    isAccepted: {
      enumerable: true,
      get: function() {
        return state === C.STATE_ACCEPTED;
      }
    },
    isCanceled: {
      enumerable: true,
      get: function() {
        return state === C.STATE_CANCELED;
      }
    },
    isFailed: {
      enumerable: true,
      get: function() {
        return state === C.STATE_FAILED;
      }
    },
    isPending: {
      enumerable: true,
      get: function() {
        return state === C.STATE_PENDING;
      }
    },
    isRejected: {
      enumerable: true,
      get: function() {
        return state === C.STATE_REJECTED;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return state;
      }
    },
    userAgent: {
      enumerable: true,
      value: userAgent
    }
  });
  return this;
}

InviteTransaction.PENDING   = C.STATE_PENDING;
InviteTransaction.ACCEPTED  = C.STATE_ACCEPTED;
InviteTransaction.REJECTED  = C.STATE_REJECTED;
InviteTransaction.CANCELED  = C.STATE_CANCELED;
InviteTransaction.FAILED    = C.STATE_FAILED;

inherits(InviteTransaction, EventEmitter);

InviteTransaction.prototype._setState = function _setState(state) {
  // A new state is required
  if (!state || !state.length) {
    throw new Error('Parameter "state" is required');
  }

  // There are only a limited number of valid states
  if (C.FINAL_STATES.indexOf(state) === -1) {
    throw new Error('InviteTransaction states must be one of: [' + C.FINAL_STATES.join(', ') + ']');
  }

  // State is permanent, once set
  if (this.state === C.STATE_PENDING) {
    this._state = state;
    return true;
  }

  return false;
};

InviteTransaction.prototype._setAccepted = function _setAccepted() {
  return this._setState(C.STATE_ACCEPTED);
};
InviteTransaction.prototype._setCanceled = function _setCanceled() {
  return this._setState(C.STATE_CANCELED);
};
InviteTransaction.prototype._setFailed = function _setFailed() {
  return this._setState(C.STATE_FAILED);
};
InviteTransaction.prototype._setRejected = function _setRejected() {
  return this._setState(C.STATE_REJECTED);
};

InviteTransaction.prototype.then = function then(onResolve, onReject) {
  return this._promise.then(onResolve, onReject);
};

Object.freeze(InviteTransaction.prototype);

module.exports = InviteTransaction;
