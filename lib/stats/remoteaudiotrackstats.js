'use strict';

const RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for an {@link AudioTrack}.
 * @extends RemoteTrackStats
 * @property {?AudioLevel} audioLevel - Output {@link AudioLevel}
 */
class RemoteAudioTrackStats extends RemoteTrackStats {
  /**
   * @param {string} trackId - {@link AudioTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  constructor(trackId, statsReport) {
    super(trackId, statsReport);

    Object.defineProperties(this, {
      audioLevel: {
        value: typeof statsReport.audioOutputLevel === 'number'
          ? statsReport.audioOutputLevel
          : null,
        enumerable: true
      }
    });
  }
}

module.exports = RemoteAudioTrackStats;
