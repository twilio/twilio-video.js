/**
 * @fileOverview
 * Custom Compute Pressure monitor using the Compute Pressure API.
 * @internal
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

class ComputePressureMonitor {
  constructor() {
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
  async watchCpuPressure(callback) {
    if (typeof callback !== 'function') {
      throw new Error('The CPU pressure change callback must be a function');
    }

    const PressureObserver = getPressureObserver();
    if (!PressureObserver) {
      throw new Error('PressureObserver is not supported in this environment');
    }

    this._cpuPressureChangeListeners.push(callback);

    if (!this._cpuPressureObserver) {
      this._cpuPressureObserver = new PressureObserver(records => this._handleCpuPressureRecords(records));
      await this._cpuPressureObserver.observe('cpu', {
        sampleInterval: this._sampleInterval,
      });
    }
  }

  /**
   * @returns {boolean}
   */
  isSupported() {
    return !!getPressureObserver();
  }

  /**
   * Stop watching CPU pressure changes for the given callback.
   * @param {PressureChangeCallback} callback - The callback function to stop listening to.
   * @returns {void}
   */
  unwatchCpuPressure(callback) {
    this._cpuPressureChangeListeners = this._cpuPressureChangeListeners.filter(cb => cb !== callback);
    if (this._cpuPressureChangeListeners.length === 0) {
      this.cleanup();
    }
  }

  /**
   * @param {PressureRecord[]} records - An array containing all the PressureRecords observed since the last callback.
   * @returns {void}
   */
  _handleCpuPressureRecords(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return;
    }
    const lastRecord = records[records.length - 1];
    if (!lastRecord) {
      return;
    }
    const hasChanged = lastRecord.state !== this._lastCpuPressure;

    if (hasChanged) {
      this._lastCpuPressure = lastRecord.state;
      this._cpuPressureChangeListeners.forEach(callback => callback(lastRecord));
    }
  }

  /**
   * Clean up all the resources created by the monitor.
   * @returns {void}
   */
  cleanup() {
    if (this._cpuPressureObserver) {
      this._cpuPressureObserver.disconnect();
      this._cpuPressureObserver = null;
    }
    this._cpuPressureChangeListeners = [];
    this._lastCpuPressure = null;
  }
}

module.exports = new ComputePressureMonitor();
