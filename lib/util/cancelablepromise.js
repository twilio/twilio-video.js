'use strict';

/**
 * Construct a new {@link CancelablePromise}.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 * @param {CancelablePromise.OnCreate} onCreate
 * @param {CancelablePromise.OnCancel} onCancel
*//**
 * A function to be called on {@link CancelablePromise} creation
 * @typedef {function} CancelablePromise.OnCreate
 * @param {function(*)} resolve
 * @param {function(*)} reject
 * @param {function(): boolean} isCanceled
*//**
 * A function to be called when {@link CancelablePromise#cancel} is called
 * @typedef {function} CancelablePromise.OnCancel
 */
function CancelablePromise(onCreate, onCancel) {
  var self = this;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _isCancelable: {
      writable: true,
      value: true
    },
    _isCanceled: {
      writable: true,
      value: false
    },
    _onCancel: {
      value: onCancel
    }
  });

  Object.defineProperty(this, '_promise', {
    value: new Promise(function(resolve, reject) {
      onCreate(function _resolve(value) {
        self._isCancelable = false;
        resolve(value);
      }, function _reject(reason) {
        self._isCancelable = false;
        reject(reason);
      }, function isCanceled() {
        return self._isCanceled;
      });
    })
  });
}

/**
 * Create a synchronously-rejected {@link CancelablePromise}.
 * @param {*} reason
 * @returns {Promise<*>}
 */
CancelablePromise.reject = function reject(reason) {
  return new CancelablePromise(function rejected(resolve, reject) {
    reject(reason);
  }, function onCancel() {
    // Do nothing.
  });
};

/**
 * Create a synchronously-resolved {@link CancelablePromise}.
 * @param {*|Promise<*>|Thenable<*>} result
 * @returns {CancelablePromise<*>}
 */
CancelablePromise.resolve = function resolve(result) {
  return new CancelablePromise(function resolved(resolve) {
    resolve(result);
  }, function onCancel() {
    // Do nothing.
  });
};

/**
 * Attempt to cancel the {@link CancelablePromise}.
 * @returns {this}
 */
CancelablePromise.prototype.cancel = function cancel() {
  if (this._isCancelable) {
    this._isCanceled = true;
    this._onCancel();
  }
  return this;
};

/**
 * @param {function} onRejected
 * @returns {CancelablePromise}
 */
CancelablePromise.prototype.catch = function _catch() {
  var args = [].slice.call(arguments);
  var promise = this._promise;
  return new CancelablePromise(function onCreate(resolve, reject) {
    promise.catch.apply(promise, args).then(resolve, reject);
  }, this._onCancel);
};

/**
 * @param {?function} onResolved
 * @param {function} [onRejected]
 * @returns {CancelablePromise}
 */
CancelablePromise.prototype.then = function then() {
  var args = [].slice.call(arguments);
  var promise = this._promise;
  return new CancelablePromise(function onCreate(resolve, reject) {
    promise.then.apply(promise, args).then(resolve, reject);
  }, this._onCancel);
};

module.exports = CancelablePromise;
