'use strict';

const NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * {@link NetworkQualityMediaStats} for a {@link Participant}'s audio.
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
