'use strict';
var MediaConnectionError = require('../../util/twilio-video-errors').MediaConnectionError;
/**
 * @typedef {import('../../util/twilio-video-errors').MediaConnectionError} MediaConnectionError
 * @typedef {import('../../util/twilio-video-errors').SignalingConnectionDisconnectedError} SignalingConnectionDisconnectedError
 */
/**
 * Room telemetry events
 * @internal
 */
var RoomEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function RoomEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when room enters reconnecting state
     * @param {MediaConnectionError|SignalingConnectionDisconnectedError} error - The error that caused reconnection
     * @returns {void}
     */
    RoomEvents.prototype.reconnecting = function (error) {
        var reason = error instanceof MediaConnectionError ? 'media' : 'signaling';
        this._telemetry.info({
            group: 'room',
            name: 'reconnecting',
            payload: {
                reason: reason
            }
        });
    };
    /**
     * Emit when room successfully reconnected
     * @returns {void}
     */
    RoomEvents.prototype.reconnected = function () {
        this._telemetry.info({
            group: 'room',
            name: 'reconnected'
        });
    };
    /**
     * Emit when room disconnected
     * @returns {void}
     */
    RoomEvents.prototype.disconnected = function () {
        this._telemetry.info({
            group: 'room',
            name: 'disconnected'
        });
    };
    return RoomEvents;
}());
module.exports = RoomEvents;
//# sourceMappingURL=room.js.map