'use strict';

const SenderOrReceiverReportFactory = require('./senderorreceiverreportfactory');
const SenderReport = require('./senderreport');

/**
 * @extends {SenderOrReceiverReportFactory}
 * @property {?SenderReport} lastReport
 */
class SenderReportFactory extends SenderOrReceiverReportFactory {
  /**
   * Construct a {@link SenderReportFactory}.
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
   * @param {TrackId} trackId
   * @param {RTCStats} newerStats
   * @param {RTCRemoteInboundRtpStreamStats} [newerRemoteStats]
   * @returns {SenderReport}
   */
  next(trackId, newerStats, newerRemoteStats) {
    const olderStats = this.lastStats;
    this.lastStats = newerStats;
    this.trackId = trackId;
    const report = SenderReport.of(trackId, olderStats, newerStats, newerRemoteStats);
    this.lastReport = report;
    return report;
  }
}

module.exports = SenderReportFactory;
