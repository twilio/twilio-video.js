'use strict';

const LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalAudioTrack}.
 * @extends LocalTrackStats
 * @property {?AudioLevel} audioLevel - Input {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 * @param {string} trackId - {@link LocalAudioTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
class LocalAudioTrackStats extends LocalTrackStats {
  constructor(trackId, statsReport) {
    super(trackId, statsReport);

    Object.defineProperties(this, {
      audioLevel: {
        value: typeof statsReport.audioInputLevel === 'number'
          ? statsReport.audioInputLevel
          : null,
        enumerable: true
      },
      jitter: {
        value: typeof statsReport.jitter === 'number'
          ? statsReport.jitter
          : null,
        enumerable: true
      }
    });
  }
}

/**
 * The maximum absolute amplitude of a set of audio samples in the
 * range of 0 to 32767 inclusive.
 * @typedef {number} AudioLevel
 */

module.exports = LocalAudioTrackStats;
