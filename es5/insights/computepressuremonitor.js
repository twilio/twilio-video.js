/**
 * @fileOverview
 * Custom Compute Pressure monitor using the Compute Pressure API.
 * @internal
 */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/**
 * @typedef {'cpu' | 'gpu'} PressureSource
 * @typedef {'nominal' | 'fair' | 'serious' | 'critical'} PressureState
 *
 * NOTE(lrivas): Remove once we update to a TypeScript version with definitions for the Compute Pressure API types.
 */
/**
 * @typedef {{
 *   source: PressureSource,
 *   state: PressureState,
 *   time: DOMHighResTimeStamp
 * }} PressureRecord
 */
/**
 * @typedef {{ sampleInterval?: number }} PressureObserverOptions
 */
/**
 * @callback PressureObserverCallback
 * @param {PressureRecord[]} records
 * @param {PressureObserver} observer
 */
/**
 * @typedef {{
 *   disconnect(): void,
 *   observe(source: PressureSource, options?: PressureObserverOptions): Promise<void>,
 *   unobserve(source: PressureSource): void,
 *   takeRecords(): PressureRecord[]
 * }} PressureObserver
 */
/**
 * @typedef {new (callback: PressureObserverCallback) => PressureObserver} PressureObserverConstructor
 */
/**
 * @callback PressureChangeCallback
 * @param {PressureRecord} record
 * @returns {void}
 */
/**
 * Helper to get the PressureObserver constructor from the global scope.
 * @returns {PressureObserverConstructor | null}
 */
function getPressureObserver() {
    if (typeof globalThis !== 'undefined' && typeof globalThis.PressureObserver === 'function') {
        return /** @type {PressureObserverConstructor} */ (globalThis.PressureObserver);
    }
    return null;
}
var ComputePressureMonitor = /** @class */ (function () {
    function ComputePressureMonitor() {
        /** @type {PressureState | null} */
        this._lastCpuPressure = null;
        /** @type {PressureObserver | null} */
        this._cpuPressureObserver = null;
        /** @type {number} */
        this._sampleInterval = 2000; // 2 seconds
        /** @type {PressureChangeCallback[]} */
        this._cpuPressureChangeListeners = [];
        /** @type {PressureObserverConstructor | null} */
    }
    /**
     * Start watching CPU pressure changes. This is an asynchronous operation.
     * @param {PressureChangeCallback} callback - The callback function to call when the pressure changes.
     * @returns {Promise<void>}
     */
    ComputePressureMonitor.prototype.watchCpuPressure = function (callback) {
        return __awaiter(this, void 0, void 0, function () {
            var PressureObserver;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (typeof callback !== 'function') {
                            throw new Error('The CPU pressure change callback must be a function');
                        }
                        PressureObserver = getPressureObserver();
                        if (!PressureObserver) {
                            throw new Error('PressureObserver is not supported in this environment');
                        }
                        this._cpuPressureChangeListeners.push(callback);
                        if (!!this._cpuPressureObserver) return [3 /*break*/, 2];
                        this._cpuPressureObserver = new PressureObserver(function (records) { return _this._handleCpuPressureRecords(records); });
                        return [4 /*yield*/, this._cpuPressureObserver.observe('cpu', {
                                sampleInterval: this._sampleInterval,
                            })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * @returns {boolean}
     */
    ComputePressureMonitor.prototype.isSupported = function () {
        return !!getPressureObserver();
    };
    /**
     * Stop watching CPU pressure changes for the given callback.
     * @param {PressureChangeCallback} callback - The callback function to stop listening to.
     * @returns {void}
     */
    ComputePressureMonitor.prototype.unwatchCpuPressure = function (callback) {
        this._cpuPressureChangeListeners = this._cpuPressureChangeListeners.filter(function (cb) { return cb !== callback; });
        if (this._cpuPressureChangeListeners.length === 0) {
            this.cleanup();
        }
    };
    /**
     * @param {PressureRecord[]} records - An array containing all the PressureRecords observed since the last callback.
     * @returns {void}
     */
    ComputePressureMonitor.prototype._handleCpuPressureRecords = function (records) {
        if (!Array.isArray(records) || records.length === 0) {
            return;
        }
        var lastRecord = records[records.length - 1];
        if (!lastRecord) {
            return;
        }
        var hasChanged = lastRecord.state !== this._lastCpuPressure;
        if (hasChanged) {
            this._lastCpuPressure = lastRecord.state;
            this._cpuPressureChangeListeners.forEach(function (callback) { return callback(lastRecord); });
        }
    };
    /**
     * Clean up all the resources created by the monitor.
     * @returns {void}
     */
    ComputePressureMonitor.prototype.cleanup = function () {
        if (this._cpuPressureObserver) {
            this._cpuPressureObserver.disconnect();
            this._cpuPressureObserver = null;
        }
        this._cpuPressureChangeListeners = [];
        this._lastCpuPressure = null;
    };
    return ComputePressureMonitor;
}());
module.exports = new ComputePressureMonitor();
//# sourceMappingURL=computepressuremonitor.js.map