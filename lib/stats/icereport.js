'use strict';

/**
 * @property {number} [availableSend] - bps (undefined in Firefox)
 * @property {number} recv - bps
 * @property {number} [rtt] - s (undefined in Firefox)
 * @property {number} send - bps
 */
class IceReport {
  /**
   * Construct an {@link IceReport}.
   * @param {number} send - bps
   * @param {number} recv - bps
   * @param {number} [rtt] - s
   * @param {number} [availableSend] - bps
   */
  constructor(send, recv, availableSend, rtt) {
    Object.defineProperties(this, {
      availableSend: {
        enumerable: true,
        value: availableSend
      },
      recv: {
        enumerable: true,
        value: recv
      },
      rtt: {
        enumerable: true,
        value: rtt
      },
      send: {
        enumerable: true,
        value: send
      }
    });
  }

  /**
   * @param {RTCStats} olderStats
   * @param {RTCStats} newerStats
   * @returns {IceReport}
   */
  static of(olderStats, newerStats) {
    const secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
    const deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
    const deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
    const send = secondsElapsed > 0
      ? (deltaBytesSent / secondsElapsed) * 8
      : 0;
    const recv = secondsElapsed > 0
      ? (deltaBytesReceived / secondsElapsed) * 8
      : 0;
    const { availableOutgoingBitrate: availableSend, currentRoundTripTime: rtt } = newerStats;
    return new IceReport(send, recv, availableSend, rtt);
  }
}

module.exports = IceReport;
