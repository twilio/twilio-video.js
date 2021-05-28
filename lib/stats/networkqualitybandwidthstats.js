'use strict';

/**
 * Bandwidth network quality statistics.
 * @property {?number} actual - the actual bandwidth used, in bits per second
 * @property {?number} available - an estimate of available useable bandwidth, in bits per second
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
