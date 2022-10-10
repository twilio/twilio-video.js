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
 * Statistics for a remote {@link Track}.
 * @extends TrackStats
 * @property {?number} bytesReceived - Number of bytes received
 * @property {?number} packetsReceived - Number of packets received
 */
var RemoteTrackStats = /** @class */ (function (_super) {
    __extends(RemoteTrackStats, _super);
    /*
     * @param {string} trackId - {@link Track} ID
     * @param {StandardizedTrackStatsReport} statsReport
     */
    function RemoteTrackStats(trackId, statsReport) {
        var _this = _super.call(this, trackId, statsReport) || this;
        Object.defineProperties(_this, {
            bytesReceived: {
                value: typeof statsReport.bytesReceived === 'number'
                    ? statsReport.bytesReceived
                    : null,
                enumerable: true
            },
            packetsReceived: {
                value: typeof statsReport.packetsReceived === 'number'
                    ? statsReport.packetsReceived
                    : null,
                enumerable: true
            }
        });
        return _this;
    }
    return RemoteTrackStats;
}(TrackStats));
module.exports = RemoteTrackStats;
//# sourceMappingURL=remotetrackstats.js.map