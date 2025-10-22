'use strict';

/**
 * GetUserMedia telemetry events
 * @internal
 */
class GetUserMediaEvents {
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when getUserMedia succeeds
   */
  succeeded() {
    this._telemetry.info({
      group: 'get-user-media',
      name: 'succeeded'
    });
  }

  /**
   * Emit when getUserMedia is denied by user
   */
  denied() {
    this._telemetry.info({
      group: 'get-user-media',
      name: 'denied'
    });
  }

  /**
   * Emit when getUserMedia fails (non-permission error)
   * @param {Error} error - The error from getUserMedia
   */
  failed(error) {
    this._telemetry.info({
      group: 'get-user-media',
      name: 'failed',
      payload: {
        name: error.name,
        message: error.message
      }
    });
  }
}

module.exports = GetUserMediaEvents;
