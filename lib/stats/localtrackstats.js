'use strict';

const TrackStats = require('./trackstats');

/**
 * Statistics for a {@link LocalTrack}.
 * @extends TrackStats
 * @property {?number} bytesSent - Number of bytes sent
 * @property {?number} packetsSent - Number of packets sent
 * @property {?number} roundTripTime - Round trip time in milliseconds
 */
class LocalTrackStats extends TrackStats {
  /**
   * @param {string} trackId - {@link LocalTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   * @param {boolean} prepareForInsights
   */
  constructor(trackId, statsReport, prepareForInsights) {
    super(trackId, statsReport);

    Object.defineProperties(this, {
      bytesSent: {
        value: typeof statsReport.bytesSent === 'number'
          ? statsReport.bytesSent
          : prepareForInsights ? 0 : null,
        enumerable: true
      },
      packetsSent: {
        value: typeof statsReport.packetsSent === 'number'
          ? statsReport.packetsSent
          : prepareForInsights ? 0 : null,
        enumerable: true
      },
      roundTripTime: {
        value: typeof statsReport.roundTripTime === 'number'
          ? statsReport.roundTripTime
          : prepareForInsights ? 0 : null,
        enumerable: true
      }
    });
  }
}

module.exports = LocalTrackStats;
