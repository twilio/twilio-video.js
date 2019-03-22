'use strict';

/**
 * Fraction lost network quality statistics.
 * @property {?number} fractionLost
 * @property {?number} level
 */
class NetworkQualityFractionLostStats {

  /**
   * @param {FractionLostStats} fractionLostStats
   */
  constructor({ fractionLost = null, level = null } = {}) {
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
