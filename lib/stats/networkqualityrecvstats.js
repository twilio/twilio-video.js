'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * Network quality statistics based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats#recv} is calculated.
 */
class NetworkQualityRecvStats extends NetworkQualitySendOrRecvStats {
  /**
   * Construct a {@link NetworkQualityRecvStats}.
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  constructor(sendOrRecvStats) {
    super(sendOrRecvStats);
  }
}

module.exports = NetworkQualityRecvStats;
