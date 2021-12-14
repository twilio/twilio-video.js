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
 * Statistics for a {@link LocalAudioTrack}.
 * @extends LocalTrackStats
 * @property {?AudioLevel} audioLevel - Input {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 */
var LocalAudioTrackStats = /** @class */ (function (_super) {
    __extends(LocalAudioTrackStats, _super);
    /**
     * @param {string} trackId - {@link LocalAudioTrack} ID
     * @param {StandardizedTrackStatsReport} statsReport
     * @param {boolean} prepareForInsights
     */
    function LocalAudioTrackStats(trackId, statsReport, prepareForInsights) {
        var _this = _super.call(this, trackId, statsReport, prepareForInsights) || this;
        Object.defineProperties(_this, {
            audioLevel: {
                value: typeof statsReport.audioInputLevel === 'number'
                    ? statsReport.audioInputLevel
                    : null,
                enumerable: true
            },
            jitter: {
                value: typeof statsReport.jitter === 'number'
                    ? statsReport.jitter
                    : null,
                enumerable: true
            }
        });
        return _this;
    }
    return LocalAudioTrackStats;
}(LocalTrackStats));
/**
 * The maximum absolute amplitude of a set of audio samples in the
 * range of 0 to 32767 inclusive.
 * @typedef {number} AudioLevel
 */
module.exports = LocalAudioTrackStats;
//# sourceMappingURL=localaudiotrackstats.js.map