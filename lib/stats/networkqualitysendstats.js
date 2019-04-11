'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * Network quality statistics based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats#send} is calculated.
 */
class NetworkQualitySendStats extends NetworkQualitySendOrRecvStats {
  /**
   * Construct a {@link NetworkQualitySendStats}.
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  constructor(sendOrRecvStats) {
    super(sendOrRecvStats);
  }
}

module.exports = NetworkQualitySendStats;
