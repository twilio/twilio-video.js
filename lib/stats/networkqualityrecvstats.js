'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * Network quality video stats.
 */
class NetworkQualityRecvStats extends NetworkQualitySendOrRecvStats {

  /**
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  constructor(sendOrRecvStats) {
    super(sendOrRecvStats);
  }
}

module.exports = NetworkQualityRecvStats;
