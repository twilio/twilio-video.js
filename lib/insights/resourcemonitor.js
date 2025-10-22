'use strict';

const computePressureMonitor = require('./computepressuremonitor');
const telemetry = require('./telemetry');

/**
 * ResourceMonitor handles publishing system resource events to the Insights gateway.
 * @internal
 */
class ResourceMonitor {
  /**
   * Create a ResourceMonitor
   * @param {Log} log - Logger instance
   */
  constructor(log) {
    if (!log) {
      throw new Error('ResourceMonitor requires a log instance');
    }

    this._log = log;
    this._cpuPressureHandler = null;

    this._setupCPUMonitoring();
  }

  /**
   * Setup CPU pressure monitoring
   * @private
   */
  _setupCPUMonitoring() {
    if (!computePressureMonitor.isSupported()) {
      this._log.debug('CPU pressure monitoring not supported');
      return;
    }

    this._cpuPressureHandler = pressureRecord => {
      this._log.debug('CPU pressure changed:', pressureRecord);
      telemetry.system.cpuPressureChanged(pressureRecord.state);
    };

    computePressureMonitor.watchCpuPressure(this._cpuPressureHandler)
      .then(() => {
        this._log.debug('CPU pressure monitoring initialized');
      })
      .catch(error => {
        this._log.error('Error initializing CPU pressure monitoring:', error);
      });
  }

  /**
   * Cleanup all resource monitors
   */
  cleanup() {
    this._log.debug('Cleaning up resource monitors');

    if (this._cpuPressureHandler) {
      computePressureMonitor.unwatchCpuPressure(this._cpuPressureHandler);
      this._cpuPressureHandler = null;
    }
  }
}

module.exports = ResourceMonitor;
