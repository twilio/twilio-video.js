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

CancelablePromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

CancelablePromise.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

module.exports = CancelablePromise;
