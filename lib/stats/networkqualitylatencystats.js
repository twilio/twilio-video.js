'use strict';

/**
 * Latency network quality statistics.
 * @property {?number} jitter
 * @property {?number} rtt
 * @property {?number} level
 */
class NetworkQualityLatencyStats {

  /**
   * @param {LatencyStats} latencyStats
   */
  constructor({ jitter = null, rtt = null, level = null } = {}) {
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
