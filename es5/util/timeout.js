'use strict';
/**
 * A {@link Timeout} represents a resettable and clearable timeout.
 */
var Timeout = /** @class */ (function () {
    /**
     * Construct a {@link Timeout}.
     * @param {function} fn - Function to call
     * @param {number} delay - Delay in milliseconds
     * @param {boolean} [autoStart=true] - If true, then start the {@link Timeout}.
     */
    function Timeout(fn, delay, autoStart) {
        if (autoStart === void 0) { autoStart = true; }
        Object.defineProperties(this, {
            _delay: {
                value: delay,
                writable: true
            },
            _fn: {
                value: fn
            },
            _timeout: {
                value: null,
                writable: true
            }
        });
        if (autoStart) {
            this.start();
        }
    }
    Object.defineProperty(Timeout.prototype, "delay", {
        /**
         * The {@link Timeout} delay in milliseconds.
         * @property {number}
         */
        get: function () {
            return this._delay;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Timeout.prototype, "isSet", {
        /**
         * Whether the {@link Timeout} is set.
         * @property {boolean}
         */
        get: function () {
            return !!this._timeout;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Update the {@link Timeout} delay.
     * @param {number} delay
     * @returns {void}
     */
    Timeout.prototype.setDelay = function (delay) {
        this._delay = delay;
    };
    /**
     * Start the {@link Timeout}, if not already started.
     * @returns {void}
     */
    Timeout.prototype.start = function () {
        var _this = this;
        if (!this.isSet) {
            this._timeout = setTimeout(function () {
                var fn = _this._fn;
                _this.clear();
                fn();
            }, this._delay);
        }
    };
    /**
     * Clear the {@link Timeout}.
     * @returns {void}
     */
    Timeout.prototype.clear = function () {
        clearTimeout(this._timeout);
        this._timeout = null;
    };
    /**
     * Reset the {@link Timeout}.
     * @returns {void}
     */
    Timeout.prototype.reset = function () {
        this.clear();
        this.start();
    };
    return Timeout;
}());
module.exports = Timeout;
//# sourceMappingURL=timeout.js.map