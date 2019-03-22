'use strict';

const NetworkQualityBandwidthStats = require('./networkqualitybandwidthstats');
const NetworkQualityFractionLostStats = require('./networkqualityfractionloststats');
const NetworkQualityLatencyStats = require('./networkqualitylatencystats');

/**
 * Send or recv network quality statistics.
 * @property {?NetworkQualityBandwidthStats} bandwidth
 * @property {?NetworkQualityLatencyStats} latency
 * @property {?NetworkQualityFractionLostStats} fractionLost
 */
class NetworkQualitySendOrRecvStats {

  /**
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  constructor({ bandwidth = null, fractionLost = null, latency = null } = {}) {
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
