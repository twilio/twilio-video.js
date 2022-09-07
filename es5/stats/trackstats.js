'use strict';
/**
 * Statistics for a {@link Track}.
 * @property {Track.ID} trackId - The {@link Track} ID
 * @property {Track.SID} trackSid - The {@link Track}'s SID when published in
 *  in a {@link Room}
 * @property {number} timestamp - A Unix timestamp in milliseconds indicating
 *   when the {@link TrackStats} were gathered
 * @property {string} ssrc - The {@link Track}'s SSRC when transmitted over the
 *   RTCPeerConnection
 * @property {?number} packetsLost - The number of packets lost
 * @property {?string} codec - The name of the codec used to encode the
 *   {@link Track}'s media
 */
var TrackStats = /** @class */ (function () {
    /**
     * @param {string} trackId - {@link Track} ID
     * @param {StandardizedTrackStatsReport} statsReport
     */
    function TrackStats(trackId, statsReport) {
        if (typeof trackId !== 'string') {
            throw new Error('Track id must be a string');
        }
        Object.defineProperties(this, {
            trackId: {
                value: trackId,
                enumerable: true
            },
            trackSid: {
                value: statsReport.trackSid,
                enumerable: true
            },
            timestamp: {
                value: statsReport.timestamp,
                enumerable: true
            },
            ssrc: {
                value: statsReport.ssrc,
                enumerable: true
            },
            packetsLost: {
                value: typeof statsReport.packetsLost === 'number'
                    ? statsReport.packetsLost
                    : null,
                enumerable: true
            },
            codec: {
                value: typeof statsReport.codecName === 'string'
                    ? statsReport.codecName
                    : null,
                enumerable: true
            }
        });
    }
    return TrackStats;
}());
module.exports = TrackStats;
//# sourceMappingURL=trackstats.js.map