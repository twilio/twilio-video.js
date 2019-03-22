'use strict';

const NetworkQualityAudioStats = require('./networkqualityaudiostats');
const NetworkQualityVideoStats = require('./networkqualityvideostats');

/**
 * Network quality statistics for {@link LocalParticipant} or {@link RemoteParticipant}.
 * @property {number} level
 * @property {?NetworkQualityAudioStats} audio
 * @property {?NetworkQualityVideoStats} video
 */
class NetworkQualityStats {

  /**
   * @param {NetworkQualityLevels} networkQualityLevels
   */
  constructor({ level, audio, video }) {
    Object.defineProperties(this, {
      level: {
        value: level,
        enumerable: true
      },
      audio: {
        value: audio ? new NetworkQualityAudioStats(audio) : null,
        enumerable: true
      },
      video: {
        value: video ? new NetworkQualityVideoStats(video) : null,
        enumerable: true
      }
    });
  }
}

module.exports = NetworkQualityStats;
