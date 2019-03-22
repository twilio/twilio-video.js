'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * Network quality audio stats.
 */
class NetworkQualityAudioStats extends NetworkQualityMediaStats {

  /**
   * @param {MediaLevels} mediaLevels
   */
  constructor(mediaLevels) {
    super(mediaLevels);
  }
}

module.exports = NetworkQualityAudioStats;
