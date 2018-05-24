'use strict';

const ReceiverReport = require('./receiverreport');
const SenderReport = require('./senderreport');

/**
 * @interface SenderAndReceiverReports
 * @property {Array<SenderReport>} send
 * @property {Array<ReceiverReport>} recv
 */

/**
 * @interface SenderAndReceiverSummary
 * @property {SenderSummary} send
 * @property {ReceiverSummary} recv
 */

/**
 * @interface PeerConnectionSummary
 * @property {IceReport} ice
 * @property {SenderSummary} send
 * @property {ReceiverSummary} recv
 * @property {SenderAndReceiverSummary} audio
 * @property {SenderAndReceiverSummary} video
 */

/**
 * @property {IceReport} ice
 * @roperty {SenderAndReceiverReports} audio
 * @roperty {SenderAndReceiverReports} video
 */
class PeerConnectionReport {
  /**
   * Construct a {@link PeerConnectionReport}.
   * @param {IceReport} ice
   * @param {SenderAndReceiverReports} audio
   * @param {SenderAndReceiverReports} video
   */
  constructor(ice, audio, video) {
    Object.defineProperties(this, {
      ice: {
        enumerable: true,
        value: ice
      },
      audio: {
        enumerable: true,
        value: audio
      },
      video: {
        enumerable: true,
        value: video
      }
    });
  }

  /**
   * Summarize the {@link PeerConnectionReport} by summarizing its
   * {@link SenderReport}s and {@link ReceiverReport}s.
   * @returns {PeerConnectionSummary}
   */
  summarize() {
    const senderReports = this.audio.send.concat(this.video.send);
    const send = SenderReport.summarize(senderReports);

    const receiverReports = this.audio.recv.concat(this.video.recv);
    const recv = ReceiverReport.summarize(receiverReports);

    return {
      ice: this.ice,
      send,
      recv,
      audio: {
        send: SenderReport.summarize(this.audio.send),
        recv: ReceiverReport.summarize(this.audio.recv)
      },
      video: {
        send: SenderReport.summarize(this.video.send),
        recv: ReceiverReport.summarize(this.video.recv)
      }
    };
  }
}

module.exports = PeerConnectionReport;
