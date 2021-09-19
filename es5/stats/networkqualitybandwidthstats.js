'use strict';
/**
 * Bandwidth network quality statistics.
 * @property {?number} actual - the actual bandwidth used, in bits per second
 * @property {?number} available - an estimate of available useable bandwidth, in bits per second
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for bandwidth
 */
var NetworkQualityBandwidthStats = /** @class */ (function () {
    /**
     * Construct a {@link NetworkQualityBandwidthStats}.
     * @param {BandwidthStats} bandwidthStats
     */
    function NetworkQualityBandwidthStats(_a) {
        var _b = _a.actual, actual = _b === void 0 ? null : _b, _c = _a.available, available = _c === void 0 ? null : _c, _d = _a.level, level = _d === void 0 ? null : _d;
        Object.defineProperties(this, {
            actual: {
                value: actual,
                enumerable: true
            },
            available: {
                value: available,
                enumerable: true
            },
            level: {
                value: level,
                enumerable: true
            }
        });
    }
    return NetworkQualityBandwidthStats;
}());
module.exports = NetworkQualityBandwidthStats;
//# sourceMappingURL=networkqualitybandwidthstats.js.map