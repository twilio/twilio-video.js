'use strict';
var defer = require('./').defer;
/**
 * An {@link AsyncVar} is an "asynchronous variable" which may or may not
 * contain a value of some type T. You can put a value into the {@link AsyncVar}
 * with {@link AsyncVar#put}. Callers can take a value out of the
 * {@link AsyncVar} by queueing up with {@link AsyncVar#take}. N calls to
 * {@link AsyncVar#take} require N calls to {@link AsyncVar#put} to resolve, and
 * they resolve in order.
 */
var AsyncVar = /** @class */ (function () {
    /**
     * Construct an {@link AsyncVar}.
     */
    function AsyncVar() {
        Object.defineProperties(this, {
            _deferreds: {
                value: []
            },
            _hasValue: {
                value: false,
                writable: true
            },
            _value: {
                value: null,
                writable: true
            }
        });
    }
    /**
     * Put a value into the {@link AsyncVar}.
     * @param {T} value
     * @returns {this}
     */
    AsyncVar.prototype.put = function (value) {
        this._hasValue = true;
        this._value = value;
        var deferred = this._deferreds.shift();
        if (deferred) {
            deferred.resolve(value);
        }
        return this;
    };
    /**
     * Take the value out of the {@link AsyncVar}.
     * @returns {Promise<T>}
     */
    AsyncVar.prototype.take = function () {
        var _this = this;
        if (this._hasValue && !this._deferreds.length) {
            this._hasValue = false;
            return Promise.resolve(this._value);
        }
        var deferred = defer();
        this._deferreds.push(deferred);
        return deferred.promise.then(function (value) {
            _this._hasValue = false;
            return value;
        });
    };
    return AsyncVar;
}());
module.exports = AsyncVar;
//# sourceMappingURL=asyncvar.js.map