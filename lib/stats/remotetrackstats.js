'use strict';

const TrackStats = require('./trackstats');

/**
 * Statistics for a remote {@link Track}.
 * @extends TrackStats
 * @property {?number} bytesReceived - Number of bytes received
 * @property {?number} packetsReceived - Number of packets received
 */
class RemoteTrackStats extends TrackStats {
  /**
   * @param {string} trackId - {@link Track} ID
   * @param {StandardizedTrackStatsReport} statsReport
   * @param {boolean} prepareForInsights
   */
  constructor(trackId, statsReport, prepareForInsights) {
    super(trackId, statsReport, prepareForInsights);

    Object.defineProperties(this, {
      bytesReceived: {
        value: typeof statsReport.bytesReceived === 'number'
          ? statsReport.bytesReceived
          : null,
        enumerable: true
      },
      packetsReceived: {
        value: typeof statsReport.packetsReceived === 'number'
          ? statsReport.packetsReceived
          : null,
        enumerable: true
      }
    });
  }
}

module.exports = RemoteTrackStats;
