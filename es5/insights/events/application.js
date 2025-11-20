'use strict';
/**
 * Application lifecycle telemetry events
 * @internal
 */
var ApplicationEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function ApplicationEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when application becomes visible (resumed from background)
     * @returns {void}
     */
    ApplicationEvents.prototype.resumed = function () {
        this._telemetry.info({
            group: 'application',
            name: 'resumed'
        });
    };
    /**
     * Emit when application becomes hidden (sent to background)
     * @returns {void}
     */
    ApplicationEvents.prototype.backgrounded = function () {
        this._telemetry.info({
            group: 'application',
            name: 'backgrounded'
        });
    };
    /**
     * Emit when application is about to be terminated (beforeunload)
     * @returns {void}
     */
    ApplicationEvents.prototype.terminated = function () {
        this._telemetry.info({
            group: 'application',
            name: 'terminated'
        });
    };
    return ApplicationEvents;
}());
module.exports = ApplicationEvents;
//# sourceMappingURL=application.js.map