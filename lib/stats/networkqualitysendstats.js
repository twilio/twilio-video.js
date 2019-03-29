'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * Network quality video stats.
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
