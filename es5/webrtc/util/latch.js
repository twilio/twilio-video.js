'use strict';
var defer = require('./').defer;
var states = {
    high: new Set(['low']),
    low: new Set(['high'])
};
/**
 * Construct a {@link Latch}.
 * @class
 * @classdesc A {@link Latch} has two states ("high" and "low") and methods for
 * transitioning between them ({@link Latch#raise} and {@link Latch#lower}).
 * @param {string} [initialState="low"] - either "high" or "low"
 */
var Latch = /** @class */ (function () {
    function Latch(initialState) {
        if (initialState === void 0) { initialState = 'low'; }
        var state = initialState;
        Object.defineProperties(this, {
            _state: {
                set: function (_state) {
                    var _this = this;
                    if (state !== _state) {
                        state = _state;
                        var whenDeferreds = this._whenDeferreds.get(state);
                        whenDeferreds.forEach(function (deferred) { return deferred.resolve(_this); });
                        whenDeferreds.clear();
                    }
                },
                get: function () {
                    return state;
                }
            },
            _whenDeferreds: {
                value: new Map([
                    ['high', new Set()],
                    ['low', new Set()]
                ])
            }
        });
    }
    Object.defineProperty(Latch.prototype, "state", {
        get: function () {
            return this._state;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Transition to "low".
     * @returns {this}
     * @throws {Error}
     */
    Latch.prototype.lower = function () {
        return this.transition('low');
    };
    /**
     * Transition to "high".
     * @returns {this}
     * @throws {Error}
     */
    Latch.prototype.raise = function () {
        return this.transition('high');
    };
    /**
     * Transition to a new state.
     * @param {string} newState
     * @returns {this}
     * @throws {Error}
     */
    Latch.prototype.transition = function (newState) {
        if (!states[this.state].has(newState)) {
            throw createUnreachableStateError(this.state, newState);
        }
        this._state = newState;
        return this;
    };
    /**
     * Return a Promise that resolves when the {@link Latch} transitions to
     * the specified state.
     * @param {string} state
     * @returns {Promise<this>}
     */
    Latch.prototype.when = function (state) {
        if (this.state === state) {
            return Promise.resolve(this);
        }
        if (!states[this.state].has(state)) {
            return Promise.reject(createUnreachableStateError(this.state, state));
        }
        var deferred = defer();
        this._whenDeferreds.get(state).add(deferred);
        return deferred.promise;
    };
    return Latch;
}());
/**
   * Create an unreachable state Error.
   * @param {string} from - state to be transitioned from
   * @param {string} to - state to be transitioned to
   * @return {Error}
   */
function createUnreachableStateError(from, to) {
    return new Error("Cannot transition from \"" + from + "\" to \"" + to + "\"");
}
module.exports = Latch;
//# sourceMappingURL=latch.js.map