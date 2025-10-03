/**
 * @fileOverview
 * Custom Compute Pressure monitor using the Compute Pressure API.
 *
 * The Compute Pressure API is a JavaScript API that enables you to observe the pressure of system resources such as the CPU.
 * For more information, see:
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Compute_Pressure_API}
 *
 * This class is a simple implementation of a Compute Pressure monitor using the Compute Pressure API.
 * It provides a way to monitor the Compute Pressure and trigger events when the Compute Pressure changes.
 *
 * @example
 * const computePressureMonitor = require('./computepressuremonitor');
 *
 *  try {
 *   const cpuPressureHandler = record => {
 *     console.log('New CPU Pressure:', record.state, record.source, record.time);
 *   }
 *   computePressureMonitor.onCpuPressureChange(cpuPressureHandler);
 *   // ...
 *   // Free resources after the handler once the handler is no longer needed
 *   computePressureMonitor.offCpuPressureChange(cpuPressureHandler);
 *   // ...
 *   // In case you no longer need the monitor, you can clean up all the resources created by the monitor
 *   computePressureMonitor.cleanup();
 *  } catch (error) {
 *    console.error('Error setting up CPU pressure monitor:', error);
 *  }
 */
'use strict';
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
 *   observe(source: PressureSource, options?: PressureObserverOptions): void,
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
     * @param {PressureChangeCallback} callback - The callback function to call when the pressure changes.
     * @returns {void}
     */
    ComputePressureMonitor.prototype.onCpuPressureChange = function (callback) {
        var _this = this;
        if (typeof callback !== 'function') {
            throw new Error('The CPU pressure change callback must be a function');
        }
        var PressureObserver = getPressureObserver();
        if (!PressureObserver) {
            throw new Error('PressureObserver is not supported in this environment');
        }
        this._cpuPressureChangeListeners.push(callback);
        if (!this._cpuPressureObserver) {
            this._cpuPressureObserver = new PressureObserver(function (records) { return _this._handleCpuPressureRecords(records); });
            this._cpuPressureObserver.observe('cpu', {
                sampleInterval: this._sampleInterval,
            });
        }
    };
    /**
     * @returns {boolean}
     */
    ComputePressureMonitor.prototype.isSupported = function () {
        return !!getPressureObserver();
    };
    /**
     * Stop listening to the CPU pressure change.
     * @param {PressureChangeCallback} callback - The callback function to stop listening to.
     * @returns {void}
     */
    ComputePressureMonitor.prototype.offCpuPressureChange = function (callback) {
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