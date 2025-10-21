'use strict';

const computePressureMonitor = require('./computepressuremonitor');

/**
 * ResourceMonitor handles publishing system resource events to the Insights gateway.
 *
 * @example
 * const resourceMonitor = new ResourceMonitor(eventObserver, log);
 *
 * // CPU pressure events will be published:
 * // - group: 'system', name: 'cpu-pressure-changed'
 * // - payload: { resourceType: 'cpu', pressure: 'nominal' | 'fair' | 'serious' | 'critical' }
 *
 * // Clean up when no longer needed
 * resourceMonitor.cleanup();
 */
class ResourceMonitor {
  /**
   * Create a ResourceMonitor
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
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
      this._eventObserver.emit('event', {
        group: 'system',
        name: 'cpu-pressure-changed',
        level: 'info',
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
