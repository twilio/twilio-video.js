'use strict';

/**
 * A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
*/

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CancelablePromise = function () {
  /**
   * Construct a new {@link CancelablePromise}.
   * @param {CancelablePromise.OnCreate} onCreate
   * @param {CancelablePromise.OnCancel} onCancel
  */ /**
     * A function to be called on {@link CancelablePromise} creation
     * @typedef {function} CancelablePromise.OnCreate
     * @param {function(*)} resolve
     * @param {function(*)} reject
     * @param {function(): boolean} isCanceled
     */ /**
        * A function to be called when {@link CancelablePromise#cancel} is called
        * @typedef {function} CancelablePromise.OnCancel
        */
  function CancelablePromise(onCreate, onCancel) {
    var _this = this;

    _classCallCheck(this, CancelablePromise);

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
      value: new Promise(function (resolve, reject) {
        onCreate(function (value) {
          _this._isCancelable = false;
          resolve(value);
        }, function (reason) {
          _this._isCancelable = false;
          reject(reason);
        }, function () {
          return _this._isCanceled;
        });
      })
    });
  }

  /**
   * Create a synchronously-rejected {@link CancelablePromise}.
   * @param {*} reason
   * @returns {Promise<*>}
   */


  _createClass(CancelablePromise, [{
    key: 'cancel',


    /**
     * Attempt to cancel the {@link CancelablePromise}.
     * @returns {this}
     */
    value: function cancel() {
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

  }, {
    key: 'catch',
    value: function _catch() {
      var args = [].slice.call(arguments);
      var promise = this._promise;
      return new CancelablePromise(function onCreate(resolve, reject) {
        promise.catch.apply(promise, _toConsumableArray(args)).then(resolve, reject);
      }, this._onCancel);
    }

    /**
     * @param {?function} onResolved
     * @param {function} [onRejected]
     * @returns {CancelablePromise}
     */

  }, {
    key: 'then',
    value: function then() {
      var args = [].slice.call(arguments);
      var promise = this._promise;
      return new CancelablePromise(function onCreate(resolve, reject) {
        promise.then.apply(promise, _toConsumableArray(args)).then(resolve, reject);
      }, this._onCancel);
    }
  }], [{
    key: 'reject',
    value: function reject(reason) {
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

  }, {
    key: 'resolve',
    value: function resolve(result) {
      return new CancelablePromise(function resolved(resolve) {
        resolve(result);
      }, function onCancel() {
        // Do nothing.
      });
    }
  }]);

  return CancelablePromise;
}();

module.exports = CancelablePromise;