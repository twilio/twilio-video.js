'use strict';
/**
 * Quality telemetry events
 * @internal
 */
var QualityEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function QualityEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when quality limitation reason changes for a track
     * @param {string} trackSid - Track SID
     * @param {('none'|'cpu'|'bandwidth'|'other')} qualityLimitationReason - Limitation reason
     * @returns {void}
     */
    QualityEvents.prototype.limitationChanged = function (trackSid, qualityLimitationReason) {
        this._telemetry.info({
            group: 'quality',
            name: 'quality-limitation-state-changed',
            payload: {
                trackSid: trackSid,
                qualityLimitationReason: qualityLimitationReason
            }
        });
    };
    /**
     * Emit stats report
     * @param {Record<string, any>} payload - Stats report payload
     * @returns {void}
     */
    QualityEvents.prototype.statsReport = function (payload) {
        this._telemetry.info({
            group: 'quality',
            name: 'stats-report',
            payload: payload
        });
    };
    /**
     * Emit active ICE candidate pair
     * @param {Record<string, any>} payload - ICE candidate pair payload
     * @returns {void}
     */
    QualityEvents.prototype.iceCandidatePair = function (payload) {
        this._telemetry.info({
            group: 'quality',
            name: 'active-ice-candidate-pair',
            payload: payload
        });
    };
    return QualityEvents;
}());
module.exports = QualityEvents;
//# sourceMappingURL=quality.js.map