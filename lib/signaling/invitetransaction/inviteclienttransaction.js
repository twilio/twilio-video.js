'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
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
 * @property {?LocalMedia} media - the {@link LocalMedia} to use
 * @property {Array<string>} to - the recipient(s) of the
 *   {@link InviteClientTransaction}
 * @augments InviteTransaction
 */
function InviteClientTransaction(userAgent, to, options) {
  options = util.withDefaults({ }, options);

  InviteTransaction.call(this, userAgent, to, options);

  var media = options.localMedia;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _media: {
      set: function(_media) {
        media = _media;
      }
    },
    media: {
      enumerable: true,
      get: function() {
        return media;
      }
    },
    to: {
      enumerable: true,
      value: to
    }
  });
}

inherits(InviteClientTransaction, InviteTransaction);

/**
 * Cancel the {@link InviteClientTransaction}.
 * @fires InviteTransaction#canceled
 * @returns {this}
 */
InviteClientTransaction.prototype.cancel = function cancel() {
  if (!this._setCanceled()) {
    throw new Error('InviteClientTransaction already in state: ' + this._state);
  }
  this._deferred.reject(this);
  return this;
};

module.exports = InviteClientTransaction;
