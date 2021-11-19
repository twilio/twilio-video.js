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
var LocalTrackStats = require('./localtrackstats');
/**
 * Statistics for a {@link LocalVideoTrack}.
 * @extends LocalTrackStats
 * @property {?VideoTrack#Dimensions} captureDimensions - Video capture resolution
 * @property {?VideoTrack#Dimensions} dimensions - Video encoding resolution
 * @property {?number} captureFrameRate - Video capture frame rate
 * @property {?number} frameRate - Video encoding frame rate
 */
var LocalVideoTrackStats = /** @class */ (function (_super) {
    __extends(LocalVideoTrackStats, _super);
    /**
     * @param {string} trackId - {@link LocalVideoTrack} ID
     * @param {StandardizedTrackStatsReport} statsReport
     * @param {boolean} prepareForInsights
     */
    function LocalVideoTrackStats(trackId, statsReport, prepareForInsights) {
        var _this = _super.call(this, trackId, statsReport, prepareForInsights) || this;
        var captureDimensions = null;
        if (typeof statsReport.frameWidthInput === 'number' &&
            typeof statsReport.frameHeightInput === 'number') {
            captureDimensions = {};
            Object.defineProperties(captureDimensions, {
                width: {
                    value: statsReport.frameWidthInput,
                    enumerable: true
                },
                height: {
                    value: statsReport.frameHeightInput,
                    enumerable: true
                }
            });
        }
        var dimensions = null;
        if (typeof statsReport.frameWidthSent === 'number' &&
            typeof statsReport.frameHeightSent === 'number') {
            dimensions = {};
            Object.defineProperties(dimensions, {
                width: {
                    value: statsReport.frameWidthSent,
                    enumerable: true
                },
                height: {
                    value: statsReport.frameHeightSent,
                    enumerable: true
                }
            });
        }
        Object.defineProperties(_this, {
            captureDimensions: {
                value: captureDimensions,
                enumerable: true
            },
            dimensions: {
                value: dimensions,
                enumerable: true
            },
            captureFrameRate: {
                value: typeof statsReport.frameRateInput === 'number'
                    ? statsReport.frameRateInput
                    : null,
                enumerable: true
            },
            frameRate: {
                value: typeof statsReport.frameRateSent === 'number'
                    ? statsReport.frameRateSent
                    : null,
                enumerable: true
            }
        });
        return _this;
    }
    return LocalVideoTrackStats;
}(LocalTrackStats));
module.exports = LocalVideoTrackStats;
//# sourceMappingURL=localvideotrackstats.js.map