'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * Network quality statistics for a {@link Participant}'s video.
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
