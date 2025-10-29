'use strict';

const ApplicationMonitor = require('./applicationmonitor');
const NetworkMonitor = require('./networkmonitor');
const ResourceMonitor = require('./resourcemonitor');

/**
 * MonitorRegistry manages insight monitors for a Room.
 * @internal
 */
class MonitorRegistry {
  /**
   * Create a MonitorRegistry with standard room monitors
   * @param {import('../util/log')} log - Logger instance
   */
  constructor(log) {
    if (!log) {
      throw new Error('MonitorRegistry requires a log instance');
    }

    this._log = log;
    this._monitors = [
      new ApplicationMonitor(log),
      new NetworkMonitor(log),
      new ResourceMonitor(log)
    ];
  }

  /**
   * Clean up all monitors
   * Continues cleanup even if individual monitors throw errors
   */
  cleanup() {
    this._monitors.forEach(monitor => {
      try {
        monitor.cleanup();
      } catch (err) {
        this._log.warn('Failed to cleanup monitor:', err);
      }
    });
  }
}

module.exports = MonitorRegistry;
