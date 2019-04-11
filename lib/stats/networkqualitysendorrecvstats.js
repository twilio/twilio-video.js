'use strict';

const NetworkQualityBandwidthStats = require('./networkqualitybandwidthstats');
const NetworkQualityFractionLostStats = require('./networkqualityfractionloststats');
const NetworkQualityLatencyStats = require('./networkqualitylatencystats');

/**
 * Network quality statistics shared between {@link NetworkQualitySendStats} and
 * {@link NetworkQualityRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code> or
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code> is calculated.
 * @property {?NetworkQualityBandwidthStats} bandwidth - bandwidth statistics
 * @property {?NetworkQualityLatencyStats} latency - latency statistics
 * @property {?NetworkQualityFractionLostStats} fractionLost - fraction lost statistics
 */
class NetworkQualitySendOrRecvStats {
  /**
   * Construct a {@link NetworkQualitySendOrRecvStats}.
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  constructor({ bandwidth = null, fractionLost = null, latency = null }) {
    Object.defineProperties(this, {
      bandwidth: {
        value: bandwidth ? new NetworkQualityBandwidthStats(bandwidth) : null,
        enumerable: true
      },
      fractionLost: {
        value: fractionLost ? new NetworkQualityFractionLostStats(fractionLost) : null,
        enumerable: true
      },
      latency: {
        value: latency ? new NetworkQualityLatencyStats(latency) : null,
        enumerable: true
      }
    });
  }
}

module.exports = NetworkQualitySendOrRecvStats;
