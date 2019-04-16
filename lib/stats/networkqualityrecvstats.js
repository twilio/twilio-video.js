'use strict';

const NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * {@link NetworkQualitySendOrRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code> is calculated.
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
