'use strict';

/**
 * System resource telemetry events
 * @internal
 */
class SystemEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when CPU pressure state changes
   * @param {('nominal'|'fair'|'serious'|'critical')} pressure - Pressure state
   * @returns {void}
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
