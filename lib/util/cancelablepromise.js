'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

/**
 * Constructs a new {@link CancelablePromise} by wrapping the original
 * Promise with a deferred and acting as a pass-through to its Promise.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @property {boolean} isCanceled - whether or not the Promise was canceled
 * @fires CancelablePromise#canceled
 */
function CancelablePromise(original) {
  if (!(this instanceof CancelablePromise)) {
    return new CancelablePromise(original);
  }
  EventEmitter.call(this);

  var cancellation = new Error('Canceled');
  var deferred = util.defer();
  var isCanceled = false;

  var self = this;
  var promise = deferred.promise.catch(function(reason) {
    if (reason === cancellation) {
      isCanceled = true;
      self.emit('canceled', self);
    }
    throw reason;
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cancel: {
      value: deferred.reject.bind(deferred, cancellation)
    },
    _promise: {
      value: promise
    },
    isCanceled: {
      enumerable: true,
      get: function() {
        return isCanceled;
      }
    }
  });

  original.then(deferred.resolve, deferred.reject);
}

inherits(CancelablePromise, EventEmitter);

/**
 * Attempt to cancel the {@link CancelablePromise}. This method returns a
 * Promise that resolves on a successful cancellation. If cancellation fails,
 * this method rejects with a "Cancellation failed" Error.
 * @returns {Promise}
 */
CancelablePromise.prototype.cancel = function() {
  this._cancel();
  var error = new Error('Cancellation failed');
  var self = this;
  return this.then(function() {
    throw error;
  }, function() {
    if (!self.isCanceled) {
      throw error;
    }
  });
};

CancelablePromise.prototype.catch = function() {
  return this._promise.catch.apply(this._promise, arguments);
};

CancelablePromise.prototype.then = function() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link CancelablePromise} was canceled.
 * @param {CancelablePromise} promise - The {@link CancelablePromise}
 * @event CancelablePromise#canceled
 */

module.exports = CancelablePromise;
