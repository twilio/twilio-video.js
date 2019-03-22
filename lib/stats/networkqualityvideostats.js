'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * Network quality video stats.
 */
class NetworkQualityVideoStats extends NetworkQualityMediaStats {

  /**
   * @param {MediaLevels} mediaLevels
   */
  constructor(mediaLevels) {
    super(mediaLevels);
  }
}

module.exports = NetworkQualityVideoStats;
