'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var TrackStats = require('./trackstats');
/**
 * Statistics for a {@link LocalTrack}.
 * @extends TrackStats
 * @property {?number} bytesSent - Number of bytes sent
 * @property {?number} packetsSent - Number of packets sent
 * @property {?number} roundTripTime - Round trip time in milliseconds
 */
var LocalTrackStats = /** @class */ (function (_super) {
    __extends(LocalTrackStats, _super);
    /**
     * @param {string} trackId - {@link LocalTrack} ID
     * @param {StandardizedTrackStatsReport} statsReport
     * @param {boolean} prepareForInsights
     */
    function LocalTrackStats(trackId, statsReport, prepareForInsights) {
        var _this = _super.call(this, trackId, statsReport) || this;
        Object.defineProperties(_this, {
            bytesSent: {
                value: typeof statsReport.bytesSent === 'number'
                    ? statsReport.bytesSent
                    : prepareForInsights ? 0 : null,
                enumerable: true
            },
            packetsSent: {
                value: typeof statsReport.packetsSent === 'number'
                    ? statsReport.packetsSent
                    : prepareForInsights ? 0 : null,
                enumerable: true
            },
            roundTripTime: {
                value: typeof statsReport.roundTripTime === 'number'
                    ? statsReport.roundTripTime
                    : prepareForInsights ? 0 : null,
                enumerable: true
            }
        });
        return _this;
    }
    return LocalTrackStats;
}(TrackStats));
module.exports = LocalTrackStats;
//# sourceMappingURL=localtrackstats.js.map