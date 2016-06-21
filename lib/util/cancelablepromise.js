'use strict';

var inherits = require('util').inherits;
var util = require('./');

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
    },
    _onCancel: {
      value: onCancel
    }
  });
  var self = this;
  try {
    onCreate(function resolve(value) {
      self._isCancelable = false;
      self._deferred.resolve(value);
    }, function reject(reason) {
      self._isCancelable = false;
      self._deferred.reject(reason);
    }, function isCanceled() {
      return self._isCanceled;
    });
  } catch (error) {
    this._isCancelable = false;
    this._deferred.reject(error);
  }
}

inherits(CancelablePromise, Promise);

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
  return this._deferred.promise.catch.apply(this._deferred.promise, arguments);
};

CancelablePromise.prototype.then = function then() {
  return this._deferred.promise.then.apply(this._deferred.promise, arguments);
};

module.exports = CancelablePromise;
