'use strict';
/**
 * Latency network quality statistics.
 * @property {?number} jitter - media jitter in seconds
 * @property {?number} rtt - round trip time in seconds
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for latency
 */
var NetworkQualityLatencyStats = /** @class */ (function () {
    /**
     * Construct a {@link NetworkQualityLatencyStats}.
     * @param {LatencyStats} latencyStats
     */
    function NetworkQualityLatencyStats(_a) {
        var _b = _a.jitter, jitter = _b === void 0 ? null : _b, _c = _a.rtt, rtt = _c === void 0 ? null : _c, _d = _a.level, level = _d === void 0 ? null : _d;
        Object.defineProperties(this, {
            jitter: {
                value: jitter,
                enumerable: true
            },
            rtt: {
                value: rtt,
                enumerable: true
            },
            level: {
                value: level,
                enumerable: true
            }
        });
    }
    return NetworkQualityLatencyStats;
}());
module.exports = NetworkQualityLatencyStats;
//# sourceMappingURL=networkqualitylatencystats.js.map