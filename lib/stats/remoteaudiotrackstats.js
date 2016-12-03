'use strict';

var inherits = require('util').inherits;
var RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for an {@link AudioTrack}.
 * @extends RemoteTrackStats
 * @property {?AudioLevel} audioLevel - Output {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 * @param {string} trackId - {@link AudioTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function RemoteAudioTrackStats(trackId, statsReport) {
  RemoteTrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    audioLevel: {
      value: typeof statsReport.audioOutputLevel === 'number'
        ? statsReport.audioOutputLevel
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

inherits(RemoteAudioTrackStats, RemoteTrackStats);

module.exports = RemoteAudioTrackStats;
