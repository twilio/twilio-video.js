'use strict';

/**
 * Statistics for a {@link Track}.
 * @property {Track.SID} trackSid - The {@link Track}'s SID when published in
 *  in a {@link Room}
 * @property {number} timestamp - A Unix timestamp in milliseconds indicating
 *   when the {@link TrackStats} were gathered
 * @property {?number} packetsLost - The number of packets lost
 * @property {?string} codec - The name of the codec used to encode the
 *   {@link Track}'s media
 */
class TrackStats {
  /**
   * @param {string} trackId - {@link Track} ID
   * @param {StandardizedTrackStatsReport} statsReport
   * @param {boolean} prepareForInsights
   */
  constructor(trackId, statsReport, prepareForInsights) {
    if (typeof trackId !== 'string') {
      throw new Error('Track id must be a string');
    }

    Object.defineProperties(this, Object.assign(prepareForInsights ? {
      trackId: {
        value: trackId,
        enumerable: true
      },
      ssrc: {
        value: statsReport.ssrc,
        enumerable: true
      }
    } : {}, {
      trackSid: {
        value: statsReport.trackSid,
        enumerable: true
      },
      timestamp: {
        value: statsReport.timestamp,
        enumerable: true
      },
      packetsLost: {
        value: typeof statsReport.packetsLost === 'number'
          ? statsReport.packetsLost
          : null,
        enumerable: true
      },
      codec: {
        value: typeof statsReport.codecName === 'string'
          ? statsReport.codecName
          : null,
        enumerable: true
      }
    }));
  }
}

module.exports = TrackStats;
