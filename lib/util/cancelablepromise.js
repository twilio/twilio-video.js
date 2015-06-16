'use strict';

var Q = require('q');

/**
 * Constructs a new {@link CancelablePromise} by wrapping the original
 * promise with a deferred and acting as a pass-through to its promise.
 * @class
 * @classdesc A promise that can be canceled with .cancel().
 *   Wraps the passed promise.
 * @param {Promise} original - The original, uncancelable promise.
 */
function CancelablePromise(original) {
  if (!(this instanceof CancelablePromise)) {
    return new CancelablePromise(original);
  }

  if (typeof original.cancel === 'function') {
    return original;
  }

  var cancelDeferred = Q.defer();
  var combined = Q.all([original, cancelDeferred.promise]);
  var deferred = Q.defer();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    '_deferred': { value: deferred }
  });

  original.then(function() {
    cancelDeferred.resolve();
  });

  combined.then(function(results) {
    deferred.resolve(results[0]);
  }, function(reason) {
    deferred.reject(reason);
  });
}

CancelablePromise.prototype.then = function() {
  var promise = this._deferred.promise;
  return promise.then.apply(promise, arguments);
};

CancelablePromise.prototype.catch = function() {
  var promise = this._deferred.promise;
  return promise.catch.apply(promise, arguments);
};

CancelablePromise.prototype.cancel = function() {
  var deferred = this._deferred;
  return deferred.reject(new Error('canceled'));
};

module.exports = CancelablePromise;
