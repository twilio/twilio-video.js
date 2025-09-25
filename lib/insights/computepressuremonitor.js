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
 * NOTE: Remove once TypeScript ships the Compute Pressure API types.
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

    // NOTE(lrivas): Using a getter to avoid issues when PressureObserver is not defined in the global scope
    // and need to be mocked/polyfilled (e.g., test environments)
    Object.defineProperty(this, '_pressureObserver', {
      get() {
        return typeof globalThis !== 'undefined' ? globalThis.PressureObserver : null;
      },
    });
  }

  /**
   * @param {PressureChangeCallback} callback - The callback function to call when the pressure changes.
   * @returns {void}
   */
  onCpuPressureChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('The CPU pressure change callback must be a function');
    }

    this._cpuPressureChangeListeners.push(callback);

    if (!this._pressureObserver) {
      return;
    }

    if (!this._cpuPressureObserver) {
      this._cpuPressureObserver = new this._pressureObserver(records => this._handleCpuPressureRecords(records));
      this._cpuPressureObserver.observe('cpu', {
        sampleInterval: this._sampleInterval,
      });
    }
  }

  /**
   * @returns {boolean}
   */
  isSupported() {
    return !!this._pressureObserver;
  }

  /**
   * Stop listening to the CPU pressure change.
   * @param {PressureChangeCallback} callback - The callback function to stop listening to.
   * @returns {void}
   */
  offCpuPressureChange(callback) {
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
