'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
/**
 * A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
*/
var CancelablePromise = /** @class */ (function () {
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
                }, function () { return _this._isCanceled; });
            })
        });
    }
    /**
     * Create a synchronously-rejected {@link CancelablePromise}.
     * @param {*} reason
     * @returns {Promise<*>}
     */
    CancelablePromise.reject = function (reason) {
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
    CancelablePromise.resolve = function (result) {
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
    CancelablePromise.prototype.cancel = function () {
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
    CancelablePromise.prototype.catch = function () {
        var args = [].slice.call(arguments);
        var promise = this._promise;
        return new CancelablePromise(function onCreate(resolve, reject) {
            promise.catch.apply(promise, __spreadArray([], __read(args))).then(resolve, reject);
        }, this._onCancel);
    };
    /**
     * @param {?function} onResolved
     * @param {function} [onRejected]
     * @returns {CancelablePromise}
     */
    CancelablePromise.prototype.then = function () {
        var args = [].slice.call(arguments);
        var promise = this._promise;
        return new CancelablePromise(function onCreate(resolve, reject) {
            promise.then.apply(promise, __spreadArray([], __read(args))).then(resolve, reject);
        }, this._onCancel);
    };
    /**
   * @param {?function} onFinally
   * @returns {CancelablePromise}
   */
    CancelablePromise.prototype.finally = function () {
        var args = [].slice.call(arguments);
        var promise = this._promise;
        return new CancelablePromise(function onCreate(resolve, reject) {
            promise.finally.apply(promise, __spreadArray([], __read(args))).then(resolve, reject);
        }, this._onCancel);
    };
    return CancelablePromise;
}());
module.exports = CancelablePromise;
//# sourceMappingURL=cancelablepromise.js.map