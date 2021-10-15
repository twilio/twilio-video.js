"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Timer = void 0;
var Timer = /** @class */ (function () {
    function Timer() {
        // eslint-disable-next-line no-undefined
        this._end = undefined;
        this.start();
    }
    Timer.prototype.start = function () {
        this._start = Date.now();
        return this;
    };
    Timer.prototype.stop = function () {
        this._end = Date.now();
        return this;
    };
    Timer.prototype.getTimeMeasurement = function () {
        return {
            start: this._start,
            end: this._end,
            // eslint-disable-next-line no-undefined
            duration: this._end === undefined ? undefined : this._end - this._start
        };
    };
    return Timer;
}());
exports.Timer = Timer;
//# sourceMappingURL=timer.js.map