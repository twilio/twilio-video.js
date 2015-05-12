'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var Q = require('q');
var util = require('../../util');

/**
 * Construct an {@link InviteClientTransaction}.
 * @class
 * @classdesc An {@link InviteClientTransaction} is an
 *   {@link InviteTransaction} addressed from a {@link UserAgent}.
 * @param {UserAgent} userAgent - the sender of the
 *   {@link InviteClientTransaction}
 * @param {string} to - the recipient of the {@link InviteClientTransaction}
 * @param {object} [options]
 * @property {?Stream} stream - the {@link Stream} to use
 * @property {string} to - the recipient of the {@link InviteClientTransaction}
 * @augments InviteTransaction
 */
function InviteClientTransaction(userAgent, to, options) {
  InviteTransaction.call(this, userAgent, to, options);
  options = util.withDefaults(options, {
    'localStream': null
  });
  var stream = options['localStream'];
  Object.defineProperties(this, {
    '_stream': {
      set: function(_stream) {
        stream = _stream;
      }
    },
    'stream': {
      enumerable: true,
      get: function() {
        return stream;
      }
    },
    'to': {
      enumerable: true,
      value: to
    }
  });
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
