'use strict';
/**
 * System resource telemetry events
 * @internal
 */
var SystemEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function SystemEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when CPU pressure state changes
     * @param {('nominal'|'fair'|'serious'|'critical')} pressure - Pressure state
     * @returns {void}
     */
    SystemEvents.prototype.cpuPressureChanged = function (pressure) {
        this._telemetry.info({
            group: 'system',
            name: 'cpu-pressure-changed',
            payload: {
                resourceType: 'cpu',
                pressure: pressure
            }
        });
    };
    return SystemEvents;
}());
module.exports = SystemEvents;
//# sourceMappingURL=system.js.map