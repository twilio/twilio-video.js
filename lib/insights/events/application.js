'use strict';

/**
 * Application lifecycle telemetry events
 * @internal
 */
class ApplicationEvents {
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when application becomes visible (resumed from background)
   */
  resumed() {
    this._telemetry.info({
      group: 'application',
      name: 'resumed'
    });
  }

  /**
   * Emit when application becomes hidden (sent to background)
   */
  backgrounded() {
    this._telemetry.info({
      group: 'application',
      name: 'backgrounded'
    });
  }

  /**
   * Emit when application is about to be terminated (beforeunload)
   */
  terminated() {
    this._telemetry.info({
      group: 'application',
      name: 'terminated'
    });
  }
}

module.exports = ApplicationEvents;
