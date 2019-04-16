'use strict';

/**
 * Latency network quality statistics.
 * @property {?number} jitter - media jitter in seconds
 * @property {?number} rtt - round trip time in seconds
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for latency
 */
class NetworkQualityLatencyStats {
  /**
   * Construct a {@link NetworkQualityLatencyStats}.
   * @param {LatencyStats} latencyStats
   */
  constructor({ jitter = null, rtt = null, level = null }) {
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
}

module.exports = NetworkQualityLatencyStats;
