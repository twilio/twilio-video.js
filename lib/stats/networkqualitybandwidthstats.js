'use strict';

/**
 * Bandwidth network quality statistics.
 * @property {?number} actual - actual bandwidth, in bytes
 * @property {?number} available - available bandwidth, in bytes
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for bandwidth
 */
class NetworkQualityBandwidthStats {
  /**
   * Construct a {@link NetworkQualityBandwidthStats}.
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
