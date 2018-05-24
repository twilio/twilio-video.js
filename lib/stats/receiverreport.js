'use strict';

const average = require('./average');
const SenderOrReceiverReport = require('./senderorreceiverreport');
const sum = require('./sum');

/**
 * @interface ReceiverSummary
 * @property {number} bitrate
 * @property {number} fractionLost - 0–1
 * @property {number} [jitter] - s (undefined for video tracks in Chrome)
 */

/**
 * @extends SenderOrReceiverReport
 * @property {number} deltaPacketsLost
 * @property {number} deltaPacketsReceived
 * @property {number} [fractionLost] - 0–1 (undefined in Firefox)
 * @property {number} [jitter] - s (undefined for video tracks in Chrome)
 * @property {number} phonyPacketsLost - 0–1
 */
class ReceiverReport extends SenderOrReceiverReport {
  /**
   * @param {StatsId} id
   * @param {TrackId} trackId
   * @param {number} bitrate - bps
   * @param {number} deltaPacketsLost
   * @param {number} deltaPacketsReceived
   * @param {number} [fractionLost] - 0–1 (undefined in Firefox)
   * @param {number} [jitter] - s (undefined for video tracks in Chrome)
   */
  constructor(id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter) {
    super(id, trackId, bitrate);
    const phonyFractionLost = deltaPacketsReceived > 0
      ? deltaPacketsLost / deltaPacketsReceived
      : 0;
    Object.defineProperties(this, {
      deltaPacketsLost: {
        enumerable: true,
        value: deltaPacketsLost
      },
      deltaPacketsReceived: {
        enumerable: true,
        value: deltaPacketsReceived
      },
      fractionLost: {
        enumerable: true,
        value: fractionLost
      },
      jitter: {
        enumerable: true,
        value: jitter
      },
      phonyFractionLost: {
        enumerable: true,
        value: phonyFractionLost
      }
    });
  }

  /**
   * Create a {@link ReceiverReport}.
   * @param {string} trackId
   * @param {RTCStats} olderStats
   * @param {RTCStats} newerStats
   * @returns {ReceiverReport}
   */
  static of(trackId, olderStats, newerStats) {
    if (olderStats.id !== newerStats.id) {
      throw new Error('RTCStats IDs must match');
    }
    const secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
    const deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
    const bitrate = secondsElapsed > 0
      ? (deltaBytesReceived / secondsElapsed) * 8
      : 0;
    const deltaPacketsLost = Math.max(newerStats.packetsLost - olderStats.packetsLost, 0);
    const deltaPacketsReceived = newerStats.packetsReceived - olderStats.packetsReceived;
    const { fractionLost, jitter } = newerStats;
    return new ReceiverReport(olderStats.id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter);
  }

  /**
   * Summarize {@link ReceiverReport}s by summing and averaging their values.
   * @param {Array<ReceiverReport>} reports
   * @returns {ReceiverSummary}
   */
  static summarize(reports) {
    const summaries = reports.map(report => report.summarize());
    const bitrate = sum(summaries.map(summary => summary.bitrate));
    const fractionLost = average(summaries.map(summary => summary.fractionLost));
    const jitter = average(summaries.map(summary => summary.jitter));
    return {
      bitrate,
      fractionLost,
      jitter
    };
  }

  /**
   * Summarize the {@link ReceiveReport}.
   * @returns {ReceiverSummary}
   */
  summarize() {
    return {
      bitrate: this.bitrate,
      fractionLost: typeof this.fractionLost === 'number' ? this.fractionLost : this.phonyFractionLost,
      jitter: this.jitter
    };
  }
}

module.exports = ReceiverReport;
