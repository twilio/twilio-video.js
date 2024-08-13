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
 * Statistics for an {@link AudioTrack}.
 * @extends RemoteTrackStats
 * @property {?AudioLevel} audioLevel - Output {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 */
var RemoteAudioTrackStats = /** @class */ (function (_super) {
    __extends(RemoteAudioTrackStats, _super);
    /**
     * @param {string} trackId - {@link AudioTrack} ID
     * @param {StandardizedTrackStatsReport} statsReport
     */
    function RemoteAudioTrackStats(trackId, statsReport) {
        var _this = _super.call(this, trackId, statsReport) || this;
        Object.defineProperties(_this, {
            audioLevel: {
                value: typeof statsReport.audioOutputLevel === 'number'
                    ? statsReport.audioOutputLevel
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
    return RemoteAudioTrackStats;
}(RemoteTrackStats));
module.exports = RemoteAudioTrackStats;
//# sourceMappingURL=remoteaudiotrackstats.js.map