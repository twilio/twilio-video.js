'use strict';
/**
 * The {@link DocumentVisibilityMonitor} monitors the visibility state of the DOM
 * and executes the attached listeners in phase order when the DOM is visible.
 */
var DocumentVisibilityMonitor = /** @class */ (function () {
    /**
     * Constructor.
     * @param {number} [nPhases=1] - the number of phases
     */
    function DocumentVisibilityMonitor(nPhases) {
        var _this = this;
        if (nPhases === void 0) { nPhases = 1; }
        Object.defineProperties(this, {
            _listeners: {
                value: []
            },
            _onVisibilityChange: {
                value: function () {
                    _this._emitVisible(document.visibilityState === 'visible');
                }
            }
        });
        for (var i = 0; i < nPhases; i++) {
            this._listeners.push([]);
        }
    }
    /**
     * clears the state.
     */
    DocumentVisibilityMonitor.prototype.clear = function () {
        var nPhases = this._listeners.length;
        for (var i = 0; i < nPhases; i++) {
            this._listeners[i] = [];
        }
    };
    DocumentVisibilityMonitor.prototype._listenerCount = function () {
        return this._listeners.reduce(function (count, phaseListeners) { return count + phaseListeners.length; }, 0);
    };
    /**
     * Call all the listeners. Makes sure that all listeners for a given phase
     * are executed before calling the listeners of the next phase.
     * @private
     */
    DocumentVisibilityMonitor.prototype._emitVisible = function (isVisible) {
        var _this = this;
        var promise = Promise.resolve();
        var _loop_1 = function (phase) {
            promise = promise.then(function () { return _this._emitVisiblePhase(phase, isVisible); });
        };
        for (var phase = 1; phase <= this._listeners.length; phase++) {
            _loop_1(phase);
        }
        return promise;
    };
    /**
     * Call all the listeners for a given phase.
     * @private
     */
    DocumentVisibilityMonitor.prototype._emitVisiblePhase = function (phase, isVisible) {
        var phaseListeners = this._listeners[phase - 1];
        return Promise.all(phaseListeners.map(function (listener) {
            var ret = listener(isVisible);
            return ret instanceof Promise ? ret : Promise.resolve(ret);
        }));
    };
    /**
     * Start listening to the DOM visibility state change.
     * @private
     */
    DocumentVisibilityMonitor.prototype._start = function () {
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    };
    /**
     * Stop listening to the DOM visibility state change.
     * @private
     */
    DocumentVisibilityMonitor.prototype._stop = function () {
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
    };
    /**
     * Listen for the DOM visibility changes at the given phase.
     * @param {number} phase
     * @param {function} listener
     * @returns {this}
     */
    DocumentVisibilityMonitor.prototype.onVisibilityChange = function (phase, listener) {
        if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
            throw new Error('invalid phase: ', phase);
        }
        var phaseListeners = this._listeners[phase - 1];
        phaseListeners.push(listener);
        if (this._listenerCount() === 1) {
            this._start();
        }
        return this;
    };
    /**
     * Stop listening for the DOM visibility change at the given phase.
     * @param {number} phase
     * @param {function} listener
     * @returns {this}
     */
    DocumentVisibilityMonitor.prototype.offVisibilityChange = function (phase, listener) {
        if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
            throw new Error('invalid phase: ', phase);
        }
        var phaseListeners = this._listeners[phase - 1];
        var index = phaseListeners.indexOf(listener);
        if (index !== -1) {
            phaseListeners.splice(index, 1);
            if (this._listenerCount() === 0) {
                this._stop();
            }
        }
        return this;
    };
    return DocumentVisibilityMonitor;
}());
module.exports = new DocumentVisibilityMonitor(2);
//# sourceMappingURL=documentvisibilitymonitor.js.map