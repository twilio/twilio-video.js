'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * {@link NetworkQualitySendOrRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code> is calculated.
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
