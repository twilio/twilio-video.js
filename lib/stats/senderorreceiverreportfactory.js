'use strict';

/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {RTCStats} lastStats
 */
class SenderOrReceiverReportFactory {
  /**
   * @param {StatsId} id
   * @param {TrackId} trackId
   * @param {RTCStats} initialStats
   */
  constructor(id, trackId, initialStats) {
    Object.defineProperties(this, {
      id: {
        enumerable: true,
        value: id,
        writable: true
      },
      trackId: {
        enumerable: true,
        value: trackId,
        writable: true
      },
      lastStats: {
        enumerable: true,
        value: initialStats,
        writable: true
      }
    });
  }
}

module.exports = SenderOrReceiverReportFactory;
