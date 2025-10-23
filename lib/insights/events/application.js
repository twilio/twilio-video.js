'use strict';

/**
 * Application lifecycle telemetry events
 * @internal
 */
class ApplicationEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when application becomes visible (resumed from background)
   * @returns {void}
   */
  resumed() {
    this._telemetry.info({
      group: 'application',
      name: 'resumed'
    });
  }

  /**
   * Emit when application becomes hidden (sent to background)
   * @returns {void}
   */
  backgrounded() {
    this._telemetry.info({
      group: 'application',
      name: 'backgrounded'
    });
  }

  /**
   * Emit when application is about to be terminated (beforeunload)
   * @returns {void}
   */
  terminated() {
    this._telemetry.info({
      group: 'application',
      name: 'terminated'
    });
  }
}

module.exports = ApplicationEvents;
