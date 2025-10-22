'use strict';

const computePressureMonitor = require('./computepressuremonitor');
const telemetry = require('./telemetry');

/**
 * ResourceMonitor handles publishing system resource events to the Insights gateway.
 *
 * @example
 * const resourceMonitor = new ResourceMonitor(log);
 *
 * // CPU pressure events will be published:
 * // - group: 'system', name: 'cpu-pressure-changed'
 * // - payload: { level: 'info', resourceType: 'cpu', pressure: 'nominal' | 'fair' | 'serious' | 'critical' }
 *
 * // Clean up when no longer needed
 * resourceMonitor.cleanup();
 */
class ResourceMonitor {
  /**
   * Create a ResourceMonitor
   * @param {Object} options - Monitor options
   * @param {Log} options.log - Logger instance (required)
   */
  constructor(options) {
    if (!options?.log) {
      throw new Error('ResourceMonitor: options.log is required');
    }

    this._log = options.log;
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
      telemetry.info({
        group: 'system',
        name: 'cpu-pressure-changed',
        payload: {
          resourceType: 'cpu',
          pressure: pressureRecord.state
        }
      });
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
