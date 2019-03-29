'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * Network quality audio stats.
 */
class NetworkQualityAudioStats extends NetworkQualityMediaStats {
  /**
   * Construct a {@link NetworkQualityAudioStats}.
   * @param {MediaLevels} mediaLevels
   */
  constructor(mediaLevels) {
    super(mediaLevels);
  }
}

module.exports = NetworkQualityAudioStats;
