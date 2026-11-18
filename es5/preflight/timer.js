"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Timer = void 0;
class Timer {
    constructor() {
        // eslint-disable-next-line no-undefined
        this._end = undefined;
        this.start();
    }
    start() {
        this._start = Date.now();
        return this;
    }
    stop() {
        this._end = Date.now();
        return this;
    }
    getTimeMeasurement() {
        return {
            start: this._start,
            end: this._end,
            // eslint-disable-next-line no-undefined
            duration: this._end === undefined ? undefined : this._end - this._start
        };
    }
}
exports.Timer = Timer;
//# sourceMappingURL=timer.js.map