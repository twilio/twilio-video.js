'use strict';

const computePressureMonitor = require('./computepressuremonitor');

/**
 * ResourceEventPublisher handles publishing system resource events to the Twilio Video SDK insights.
 *
 * @example
 * const resourceEventPublisher = new ResourceEventPublisher(eventObserver, log);
 * resourceEventPublisher.cleanup();
 *
 * // Any change in resource monitoring will be published to the event observer using the following format:
 * {
 *   group: 'cpu',
 *   name: 'pressure-changed',
 *   level: 'info',
 *   payload: {
 *     state: 'nominal' | 'fair' | 'serious' | 'critical'
 *   }
 * }
 *
 * // Since CPU pressure will be monitored continuously, it is important to clean up the resource monitors
 * // when the SDK no longer needs this information.
 * resourceEventPublisher.cleanup();
 */
class ResourceEventPublisher {
  /**
   * Create a ResourceEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._cpuPressureHandler = null;
    this._log = log;

    this._setupCPUMonitoring();
  }

  /**
   * Setup CPU pressure monitoring
   * @private
   */
  _setupCPUMonitoring() {
    if (!computePressureMonitor.constructor.isSupported()) {
      this._log.debug('CPU pressure monitoring not supported');
      return;
    }

    this._cpuPressureHandler = pressureRecord => {
      this._log.debug('CPU pressure changed:', pressureRecord);
      this._publishEvent('cpu', 'pressure-changed', 'info', {
        state: pressureRecord.state
      });
    };

    try {
      computePressureMonitor.onCpuPressureChange(this._cpuPressureHandler);
      this._log.debug('CPU pressure monitoring initialized');
    } catch (error) {
      this._log.error('Error initializing CPU pressure monitoring:', error);
    }
  }

  /**
   * Publish a resource monitoring event
   * @param {string} group - Event group
   * @param {string} name - Event name
   * @param {string} level - Event level
   * @param {Object} payload - Event payload
   * @private
   */
  _publishEvent(group, name, level, payload) {
    this._eventObserver.emit('event', {
      group,
      name,
      level,
      payload
    });
  }

  /**
   * Cleanup all resource monitors
   */
  cleanup() {
    this._log.debug('Cleaning up resource monitors');

    if (this._cpuPressureHandler) {
      computePressureMonitor.offCpuPressureChange(this._cpuPressureHandler);
      this._cpuPressureHandler = null;
    }
  }
}

module.exports = ResourceEventPublisher;
