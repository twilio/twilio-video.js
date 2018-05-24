/* eslint no-undefined:0 */
'use strict';

const average = require('./average');
const SenderOrReceiverReport = require('./senderorreceiverreport');
const sum = require('./sum');

/**
 * @interface SenderSummary
 * @property {number} bitrate
 * @property {number} [rtt] - s (undefined in Chrome)
 */

/**
 * @extends SenderOrReceiverReport
 * @property {number} [rtt] - s (undefined in Chrome)
 */
class SenderReport extends SenderOrReceiverReport {
  /**
   * Construct a {@link SenderReport}.
   * @param {StatsId} id
   * @param {TrackId} trackId
   * @param {number} bitrate - bps
   * @param {number} [rtt] - s
   */
  constructor(id, trackId, bitrate, rtt) {
    super(id, trackId, bitrate);
    Object.defineProperties(this, {
      rtt: {
        enumerable: true,
        value: rtt
      }
    });
  }

  /**
   * Create a {@link SenderReport}.
   * @param {string} trackId
   * @param {RTCStats} olderStats
   * @param {RTCStats} newerStats
   * @param {RTCRemoteInboundRtpStreamStats} [newerRemoteStats]
   * @returns {SenderReport}
   */
  static of(trackId, olderStats, newerStats, newerRemoteStats) {
    if (olderStats.id !== newerStats.id) {
      throw new Error('RTCStats IDs must match');
    }
    const secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
    const deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
    const bitrate = secondsElapsed > 0
      ? (deltaBytesSent / secondsElapsed) * 8
      : 0;
    const rtt = newerRemoteStats && typeof newerRemoteStats.roundTripTime === 'number'
      ? newerRemoteStats.roundTripTime / 1000
      : undefined;
    return new SenderReport(olderStats.id, trackId, bitrate, rtt);
  }

  /**
   * Summarize {@link SenderReport}s by summing and averaging their values.
   * @param {Array<SenderReport>} reports
   * @returns {SenderSummary}
   */
  static summarize(reports) {
    const bitrate = sum(reports.map(report => report.bitrate));
    const rtt = average(reports.map(report => report.rtt));
    return {
      bitrate,
      rtt
    };
  }
}

module.exports = SenderReport;
