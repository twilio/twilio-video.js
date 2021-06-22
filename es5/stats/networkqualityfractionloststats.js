'use strict';
/**
 * Fraction lost network quality statistics.
 * @property {?number} fractionLost - packets lost
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for fraction lost
 */
var NetworkQualityFractionLostStats = /** @class */ (function () {
    /**
     * Construct a {@link NetworkQualityFractionLostStats}.
     * @param {FractionLostStats} fractionLostStats
     */
    function NetworkQualityFractionLostStats(_a) {
        var _b = _a.fractionLost, fractionLost = _b === void 0 ? null : _b, _c = _a.level, level = _c === void 0 ? null : _c;
        Object.defineProperties(this, {
            fractionLost: {
                value: fractionLost,
                enumerable: true
            },
            level: {
                value: level,
                enumerable: true
            }
        });
    }
    return NetworkQualityFractionLostStats;
}());
module.exports = NetworkQualityFractionLostStats;
//# sourceMappingURL=networkqualityfractionloststats.js.map