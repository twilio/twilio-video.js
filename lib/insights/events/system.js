'use strict';

/**
 * System resource telemetry events
 * @internal
 */
class SystemEvents {
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when CPU pressure state changes
   * @param {string} pressure - Pressure state: 'nominal', 'fair', 'serious', 'critical'
   */
  cpuPressureChanged(pressure) {
    this._telemetry.info({
      group: 'system',
      name: 'cpu-pressure-changed',
      payload: {
        resourceType: 'cpu',
        pressure
      }
    });
  }
}

module.exports = SystemEvents;
