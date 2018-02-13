'use strict';

const RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for a {@link VideoTrack}.
 * @extends RemoteTrackStats
 * @property {?VideoTrack#Dimensions} dimensions - Received video resolution
 * @property {?number} frameRate - Received video frame rate
 */
class RemoteVideoTrackStats extends RemoteTrackStats {
  /**
   * @param {string} trackId - {@link VideoTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  constructor(trackId, statsReport) {
    super(trackId, statsReport);

    let dimensions = null;
    if (typeof statsReport.frameWidthReceived === 'number' &&
        typeof statsReport.frameHeightReceived === 'number') {
      dimensions = {};

      Object.defineProperties(dimensions, {
        width: {
          value: statsReport.frameWidthReceived,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightReceived,
          enumerable: true
        }
      });
    }

    Object.defineProperties(this, {
      dimensions: {
        value: dimensions,
        enumerable: true
      },
      frameRate: {
        value: typeof statsReport.frameRateReceived === 'number'
          ? statsReport.frameRateReceived
          : null,
        enumerable: true
      }
    });
  }
}

module.exports = RemoteVideoTrackStats;
