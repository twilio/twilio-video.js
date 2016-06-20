'use strict';

var inherits = require('util').inherits;
var util = require('./');

/**
 * Construct a new {@link CancelablePromise}.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 */
function CancelablePromise() {
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: util.defer()
    },
    _isCancelable: {
      writable: true,
      value: true
    },
    _isCanceled: {
      writable: true,
      value: false
    }
  });
}

inherits(CancelablePromise, Promise);

/**
 * Attempt to cancel the {@link CancelablePromise}.
 * @returns {this}
 */
CancelablePromise.prototype.cancel = function cancel() {
  if (this._isCancelable) {
    this._isCanceled = true;
    this._cancel();
  }
  return this;
};

CancelablePromise.prototype.catch = function _catch() {
  return this._deferred.promise.catch.apply(this._deferred.promise, arguments);
};

CancelablePromise.prototype.then = function then() {
  return this._deferred.promise.then.apply(this._deferred.promise, arguments);
};

module.exports = CancelablePromise;
