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

/* globals PressureObserver */

class ComputePressureMonitor {
  _lastCpuPressure;
  _cpuPressureObserver;
  _sampleInterval = 10000; // 10 seconds
  _cpuPressureChangeListeners = [];

  /**
   * @returns {boolean} - True if the Compute Pressure API is supported, false otherwise.
   */
  static isSupported() {
    return 'PressureObserver' in window;
  }

  /**
   * @typedef {Object} PressureRecord
   * @property {string} state - The state of the pressure.
   * @property {string} source - The origin source from which the record is coming from. (E.g. 'cpu', 'gpu')
   * @property {DOMHighResTimeStamp} time - The timestamp of the pressure record in milliseconds.
   */

  /**
   * @callback pressureChangeCallback
   * @param {PressureRecord} record - The last pressure record.
   * @returns {void}
   */

  /**
   * @param {pressureChangeCallback} callback - The callback function to call when the pressure changes.
   * @returns {void}
   */
  onCpuPressureChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('The CPU pressure change callback must be a function');
    }

    this._cpuPressureChangeListeners.push(callback);

    if (!this._cpuPressureObserver) {
      this._cpuPressureObserver = new PressureObserver(records => this._handleCpuPressureRecords(records));
      this._cpuPressureObserver.observe('cpu', {
        sampleRate: this._sampleInterval,
      });
    }
  }

  /**
   * Stop listening to the CPU pressure change.
   * @param {pressureChangeCallback} callback - The callback function to stop listening to.
   * @returns {void}
   */
  offCpuPressureChange(callback) {
    this._cpuPressureChangeListeners = this._cpuPressureChangeListeners.filter(cb => cb !== callback);
    if (this._cpuPressureChangeListeners.length === 0) {
      this.cleanup();
    }
  }

  /**
   * @param {PressureRecords[]} records - An array containing all the PressureRecords that have been observed since the
   * last time the callback was called, or the last time the observer's takeRecords() method was called.
   * @returns {void}
   */
  _handleCpuPressureRecords(records) {
    const lastRecord = records[records.length - 1];
    const hasChanged = lastRecord.state !== this._lastCpuPressure;

    if (hasChanged) {
      this._lastCpuPressure = lastRecord.state;
      this._cpuPressureChangeListeners.forEach(callback => callback(lastRecord.toJSON()));
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
