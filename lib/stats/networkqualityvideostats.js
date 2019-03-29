'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * Network quality video stats.
 */
class NetworkQualityVideoStats extends NetworkQualityMediaStats {
  /**
   * Construct a {@link NetworkQualityVideoStats}.
   * @param {MediaLevels} mediaLevels
   */
  constructor(mediaLevels) {
    super(mediaLevels);
  }
}

module.exports = NetworkQualityVideoStats;
