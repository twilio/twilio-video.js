'use strict';

/**
 * Bandwidth network quality statistics.
 * @property {?number} actual
 * @property {?number} available
 * @property {?number} level
 */
class NetworkQualityBandwidthStats {

  /**
   * @param {BandwidthStats} bandwidthStats
   */
  constructor({ actual = null, available = null, level = null }) {
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
}

module.exports = NetworkQualityBandwidthStats;
