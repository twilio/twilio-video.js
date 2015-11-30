'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

/**
 * Construct a new {@link CancelablePromise}.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @property {boolean} isCanceled - whether or not the
 *   {@link CancelablePromise} was canceled
 * @fires CancelablePromise#canceled
 */
function CancelablePromise(original) {
  if (!(this instanceof CancelablePromise)) {
    return new CancelablePromise(original);
  }
  EventEmitter.call(this);

  var cancellation = new Error('Canceled');
  var deferred = util.defer();
  var isCancellable = true;
  var isCanceled = false;

  original.then(function originalResolved() {
    isCancellable = false;
    deferred.resolve.apply(deferred.promise, arguments);
  }, function originalRejected() {
    isCancellable = false;
    deferred.reject.apply(deferred.promise, arguments);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cancel: {
      value: deferred.reject.bind(deferred, cancellation)
    },
    _isCancelable: {
      get: function() {
        return isCancellable;
      }
    },
    _isCanceled: {
      get: function() {
        return isCanceled;
      },
      set: function(_isCanceled) {
        isCanceled = _isCanceled;
      }
    },
    _promise: {
      value: deferred.promise
    },
    isCanceled: {
      enumerable: true,
      get: function() {
        return isCanceled;
      }
    }
  });
}

inherits(CancelablePromise, EventEmitter);

/**
 * Attempt to cancel the {@link CancelablePromise}.
 * @throws Error
 * @returns {this}
 */
CancelablePromise.prototype.cancel = function cancel() {
  if (!this._isCancelable || this.isCanceled) {
    throw new Error('Cancellation failed');
  }
  this._isCanceled = true;
  this.emit('canceled', this);
  this._cancel();
  return this;
};

CancelablePromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

CancelablePromise.prototype.then = function _then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link CancelablePromise} was canceled.
 * @param {CancelablePromise} promise - The {@link CancelablePromise}
 * @event CancelablePromise#canceled
 */

module.exports = CancelablePromise;
