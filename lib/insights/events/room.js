'use strict';

const { MediaConnectionError } = require('../../util/twilio-video-errors');

/**
 * @typedef {import('../../util/twilio-video-errors').MediaConnectionError} MediaConnectionError
 * @typedef {import('../../util/twilio-video-errors').SignalingConnectionDisconnectedError} SignalingConnectionDisconnectedError
 */

/**
 * Room telemetry events
 * @internal
 */
class RoomEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when room enters reconnecting state
   * @param {MediaConnectionError|SignalingConnectionDisconnectedError} error - The error that caused reconnection
   * @returns {void}
   */
  reconnecting(error) {
    const reason = error instanceof MediaConnectionError ? 'media' : 'signaling';
    this._telemetry.info({
      group: 'room',
      name: 'reconnecting',
      payload: {
        reason
      }
    });
  }

  /**
   * Emit when room successfully reconnected
   * @returns {void}
   */
  reconnected() {
    this._telemetry.info({
      group: 'room',
      name: 'reconnected'
    });
  }

  /**
   * Emit when room disconnected
   * @returns {void}
   */
  disconnected() {
    this._telemetry.info({
      group: 'room',
      name: 'disconnected'
    });
  }
}

module.exports = RoomEvents;
