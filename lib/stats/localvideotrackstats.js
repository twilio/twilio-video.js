'use strict';

const LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalVideoTrack}.
 * @extends LocalTrackStats
 * @property {?VideoTrack#Dimensions} captureDimensions - Video capture resolution
 * @property {?VideoTrack#Dimensions} dimensions - Video encoding resolution
 * @property {?number} captureFrameRate - Video capture frame rate
 * @property {?number} frameRate - Video encoding frame rate
 */
class LocalVideoTrackStats extends LocalTrackStats {
  /**
   * @param {string} trackId - {@link LocalVideoTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  constructor(trackId, statsReport) {
    super(trackId, statsReport);

    let captureDimensions = null;
    if (typeof statsReport.frameWidthInput === 'number' &&
        typeof statsReport.frameHeightInput === 'number') {
      captureDimensions = {};

      Object.defineProperties(captureDimensions, {
        width: {
          value: statsReport.frameWidthInput,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightInput,
          enumerable: true
        }
      });
    }

    let dimensions = null;
    if (typeof statsReport.frameWidthSent === 'number' &&
        typeof statsReport.frameHeightSent === 'number') {
      dimensions = {};

      Object.defineProperties(dimensions, {
        width: {
          value: statsReport.frameWidthSent,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightSent,
          enumerable: true
        }
      });
    }

    Object.defineProperties(this, {
      captureDimensions: {
        value: captureDimensions,
        enumerable: true
      },
      dimensions: {
        value: dimensions,
        enumerable: true
      },
      captureFrameRate: {
        value: typeof statsReport.frameRateInput === 'number'
          ? statsReport.frameRateInput
          : null,
        enumerable: true
      },
      frameRate: {
        value: typeof statsReport.frameRateSent === 'number'
          ? statsReport.frameRateSent
          : null,
        enumerable: true
      }
    });
  }
}

module.exports = LocalVideoTrackStats;
