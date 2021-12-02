'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var EventEmitter = require('events').EventEmitter;
var util = require('./');
/**
 * A Promise that can time out.
 * @extends EventEmitter
 * @implements Promise
 * @property {?number} timeout - the timeout, in milliseconds
 * @property {boolean} isTimedOut - whether or not the
 *   {@link TimeoutPromise} timed out
 * @emits TimeoutPromise#timedOut
 */
var TimeoutPromise = /** @class */ (function (_super) {
    __extends(TimeoutPromise, _super);
    /**
     * Construct a new {@link TimeoutPromise}.
     * @param {Promise} original - a Promise
     * @param {?number} [timeout] - the timeout, in milliseconds; providing this in
     *   the constructor invokes {@link TimeoutPromise#start} (otherwise, you must
     *   call {@link TimeoutPromise#start} yourself)
     */
    function TimeoutPromise(original, initialTimeout) {
        var _this = _super.call(this) || this;
        var deferred = util.defer();
        var isTimedOut = false;
        var timedOut = new Error('Timed out');
        var timeout = null;
        var timer = null;
        /* istanbul ignore next */
        Object.defineProperties(_this, {
            _deferred: {
                value: deferred
            },
            _isTimedOut: {
                get: function () {
                    return isTimedOut;
                },
                set: function (_isTimedOut) {
                    isTimedOut = _isTimedOut;
                }
            },
            _timedOut: {
                value: timedOut
            },
            _timeout: {
                get: function () {
                    return timeout;
                },
                set: function (_timeout) {
                    timeout = _timeout;
                }
            },
            _timer: {
                get: function () {
                    return timer;
                },
                set: function (_timer) {
                    timer = _timer;
                }
            },
            _promise: {
                value: deferred.promise
            },
            isTimedOut: {
                enumerable: true,
                get: function () {
                    return isTimedOut;
                }
            },
            timeout: {
                enumerable: true,
                get: function () {
                    return timeout;
                }
            }
        });
        original.then(function (result) {
            clearTimeout(_this._timer);
            deferred.resolve(result);
        }, function (reason) {
            clearTimeout(_this._timer);
            deferred.reject(reason);
        });
        if (initialTimeout) {
            _this.start(initialTimeout);
        }
        return _this;
    }
    TimeoutPromise.prototype.catch = function () {
        var _a;
        return (_a = this._promise).catch.apply(_a, __spreadArray([], __read(arguments)));
    };
    /**
     * Start the timer that will time out the {@link TimeoutPromise} if the
     * original Promise has neither resolved nor rejected. Subsequent calls have no
     * effect once the {@link TimeoutPromise} is started.
     * @param {number} timeout - the timeout, in milliseconds
     * @returns {this}
     */
    TimeoutPromise.prototype.start = function (timeout) {
        var _this = this;
        if (this._timer) {
            return this;
        }
        this._timeout = timeout;
        this._timer = setTimeout(function () {
            if (_this._timer) {
                _this._isTimedOut = true;
                _this.emit('timedOut', _this);
                _this._deferred.reject(_this._timedOut);
            }
        }, this.timeout);
        return this;
    };
    TimeoutPromise.prototype.then = function () {
        var _a;
        return (_a = this._promise).then.apply(_a, __spreadArray([], __read(arguments)));
    };
    return TimeoutPromise;
}(EventEmitter));
/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */
module.exports = TimeoutPromise;
//# sourceMappingURL=timeoutpromise.js.map