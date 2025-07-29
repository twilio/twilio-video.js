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
var RemoteTrackStats = require('./remotetrackstats');
/**
 * Statistics for a {@link VideoTrack}.
 * @extends RemoteTrackStats
 * @property {?VideoTrack#Dimensions} dimensions - Received video resolution
 * @property {?number} frameRate - Received video frame rate
 */
var RemoteVideoTrackStats = /** @class */ (function (_super) {
    __extends(RemoteVideoTrackStats, _super);
    /**
     * @param {string} trackId - {@link VideoTrack} ID
     * @param {StandardizedTrackStatsReport} statsReport
     */
    function RemoteVideoTrackStats(trackId, statsReport) {
        var _this = _super.call(this, trackId, statsReport) || this;
        var dimensions = null;
        if (typeof statsReport.frameWidthReceived === 'number' &&
            typeof statsReport.frameHeightReceived === 'number') {
            dimensions = {};
            Object.defineProperties(dimensions, {
                width: {
                    value: statsReport.frameWidthReceived,
                    enumerable: true
                },
                height: {
                    value: statsReport.frameHeightReceived,
                    enumerable: true
                }
            });
        }
        Object.defineProperties(_this, {
            dimensions: {
                value: dimensions,
                enumerable: true
            },
            frameRate: {
                value: typeof statsReport.frameRateReceived === 'number'
                    ? statsReport.frameRateReceived
                    : null,
                enumerable: true
            }
        });
        return _this;
    }
    return RemoteVideoTrackStats;
}(RemoteTrackStats));
module.exports = RemoteVideoTrackStats;
//# sourceMappingURL=remotevideotrackstats.js.map