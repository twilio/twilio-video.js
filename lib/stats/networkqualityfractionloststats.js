'use strict';

/**
 * Fraction lost network quality statistics.
 * @property {?number} fractionLost - packets lost
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for fraction lost
 */
class NetworkQualityFractionLostStats {
  /**
   * Construct a {@link NetworkQualityFractionLostStats}.
   * @param {FractionLostStats} fractionLostStats
   */
  constructor({ fractionLost = null, level = null }) {
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
}

module.exports = NetworkQualityFractionLostStats;
