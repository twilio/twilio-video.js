/**
 * Expose `Backoff`.
 */
var Backoff = /** @class */ (function () {
    /**
     * Construct a {@link Backoff}.
     * @param {object} options
     * @property {number} min - Initial timeout in milliseconds [100]
     * @property {number} max - Max timeout [10000]
     * @property {boolean} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     */
    function Backoff(options) {
        Object.defineProperties(this, {
            _min: {
                value: options.min || 100
            },
            _max: {
                value: options.max || 10000
            },
            _jitter: {
                value: options.jitter > 0 && options.jitter <= 1 ? options.jitter : 0
            },
            _factor: {
                value: options.factor || 2
            },
            _attempts: {
                value: 0,
                writable: true
            },
            _duration: {
                enumerable: false,
                get: function () {
                    var ms = this._min * Math.pow(this._factor, this._attempts);
                    if (this._jitter) {
                        var rand = Math.random();
                        var deviation = Math.floor(rand * this._jitter * ms);
                        ms = (Math.floor(rand * 10) & 1) === 0 ? ms - deviation : ms + deviation;
                    }
                    return Math.min(ms, this._max) | 0;
                }
            },
            _timeoutID: {
                value: null,
                writable: true
            }
        });
    }
    /**
    * Start the backoff operation.
    * @param {function} fn - Function to call
    * @return {void}
    * @api public
    */
    Backoff.prototype.backoff = function (fn) {
        var _this = this;
        var duration = this._duration;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
        this._timeoutID = setTimeout(function () {
            _this._attempts++;
            fn();
        }, duration);
    };
    /**
    * Reset the number of attempts and clear the timer.
    *
    * @return {void}
    * @api public
    */
    Backoff.prototype.reset = function () {
        this._attempts = 0;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
    };
    return Backoff;
}());
module.exports = Backoff;
//# sourceMappingURL=backoff.js.map