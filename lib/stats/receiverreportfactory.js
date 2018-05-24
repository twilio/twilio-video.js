'use strict';

const ReceiverReport = require('./receiverreport');
const SenderOrReceiverReportFactory = require('./senderorreceiverreportfactory');

/**
 * @extends SenderOrReceiverReportFactory
 * @param {?ReceiverReport} lastReport
 */
class ReceiverReportFactory extends SenderOrReceiverReportFactory {
  /**
   * Construct a {@link ReceiverReportFactory}.
   * @param {TrackId} trackId
   * @param {RTCStats} initialStats
   */
  constructor(trackId, initialStats) {
    super(initialStats.id, trackId, initialStats);
    Object.defineProperties(this, {
      lastReport: {
        enumerable: true,
        value: null,
        writable: true
      }
    });
  }

  /**
   * Create a {@link ReceiverReport}.
   * @param {TrackId} trackId
   * @param {RTCStats} newerStats
   * @returns {ReceiverReport}
   */
  next(trackId, newerStats) {
    const olderStats = this.lastStats;
    this.lastStats = newerStats;
    this.trackId = trackId;
    const report = ReceiverReport.of(trackId, olderStats, newerStats);
    this.lastReport = report;
    return report;
  }
}

module.exports = ReceiverReportFactory;
