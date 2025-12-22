'use strict';
/**
 * Track telemetry events
 * @internal
 */
var TrackEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function TrackEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when a track stalls (frame rate drops below threshold)
     * @param {string} trackSid - Track SID
     * @param {number} frameRate - Current frame rate
     * @param {number} threshold - Stall threshold
     * @param {('video'|'audio')} [trackType='video'] - Track type
     * @returns {void}
     */
    TrackEvents.prototype.stalled = function (trackSid, frameRate, threshold, trackType) {
        if (trackType === void 0) { trackType = 'video'; }
        this._telemetry.warning({
            group: 'track-warning-raised',
            name: 'track-stalled',
            payload: {
                trackSid: trackSid,
                frameRate: frameRate,
                threshold: threshold,
                trackType: trackType
            }
        });
    };
    /**
     * Emit when a stalled track resumes (frame rate rises above threshold)
     * @param {string} trackSid - Track SID
     * @param {number} frameRate - Current frame rate
     * @param {number} threshold - Resume threshold
     * @param {('video'|'audio')} [trackType='video'] - Track type
     * @returns {void}
     */
    TrackEvents.prototype.resumed = function (trackSid, frameRate, threshold, trackType) {
        if (trackType === void 0) { trackType = 'video'; }
        this._telemetry.info({
            group: 'track-warning-cleared',
            name: 'track-stalled',
            payload: {
                trackSid: trackSid,
                frameRate: frameRate,
                threshold: threshold,
                trackType: trackType
            }
        });
    };
    return TrackEvents;
}());
module.exports = TrackEvents;
//# sourceMappingURL=track.js.map