'use strict';

/**
 * A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
*/
class CancelablePromise {
  /**
   * Construct a new {@link CancelablePromise}.
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
  constructor(onCreate, onCancel) {
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
      value: new Promise((resolve, reject) => {
        onCreate(value => {
          this._isCancelable = false;
          resolve(value);
        }, reason => {
          this._isCancelable = false;
          reject(reason);
        }, () => this._isCanceled);
      })
    });
  }

  /**
   * Create a synchronously-rejected {@link CancelablePromise}.
   * @param {*} reason
   * @returns {Promise<*>}
   */
  static reject(reason) {
    return new CancelablePromise(function rejected(resolve, reject) {
      reject(reason);
    }, function onCancel() {
      // Do nothing.
    });
  }

  /**
   * Create a synchronously-resolved {@link CancelablePromise}.
   * @param {*|Promise<*>|Thenable<*>} result
   * @returns {CancelablePromise<*>}
   */
  static resolve(result) {
    return new CancelablePromise(function resolved(resolve) {
      resolve(result);
    }, function onCancel() {
      // Do nothing.
    });
  }

  /**
   * Attempt to cancel the {@link CancelablePromise}.
   * @returns {this}
   */
  cancel() {
    if (this._isCancelable) {
      this._isCanceled = true;
      this._onCancel();
    }
    return this;
  }

  /**
   * @param {function} onRejected
   * @returns {CancelablePromise}
   */
  catch() {
    const args = [].slice.call(arguments);
    const promise = this._promise;
    return new CancelablePromise(function onCreate(resolve, reject) {
      promise.catch(...args).then(resolve, reject);
    }, this._onCancel);
  }

  /**
   * @param {?function} onResolved
   * @param {function} [onRejected]
   * @returns {CancelablePromise}
   */
  then() {
    const args = [].slice.call(arguments);
    const promise = this._promise;
    return new CancelablePromise(function onCreate(resolve, reject) {
      promise.then(...args).then(resolve, reject);
    }, this._onCancel);
  }
}

module.exports = CancelablePromise;
