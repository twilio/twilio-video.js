'use strict';
/**
 * GetUserMedia telemetry events
 * @internal
 */
var GetUserMediaEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function GetUserMediaEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when getUserMedia succeeds
     * @returns {void}
     */
    GetUserMediaEvents.prototype.succeeded = function () {
        this._telemetry.info({
            group: 'get-user-media',
            name: 'succeeded'
        });
    };
    /**
     * Emit when getUserMedia is denied by user
     * @returns {void}
     */
    GetUserMediaEvents.prototype.denied = function () {
        this._telemetry.info({
            group: 'get-user-media',
            name: 'denied'
        });
    };
    /**
     * Emit when getUserMedia fails (non-permission error)
     * @param {Error} error - The error from getUserMedia
     * @returns {void}
     */
    GetUserMediaEvents.prototype.failed = function (error) {
        this._telemetry.info({
            group: 'get-user-media',
            name: 'failed',
            payload: {
                name: error.name,
                message: error.message
            }
        });
    };
    return GetUserMediaEvents;
}());
module.exports = GetUserMediaEvents;
//# sourceMappingURL=getusermedia.js.map