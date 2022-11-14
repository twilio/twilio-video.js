'use strict';
var ReceiverReport = require('./receiverreport');
var SenderReport = require('./senderreport');
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
var PeerConnectionReport = /** @class */ (function () {
    /**
     * Construct a {@link PeerConnectionReport}.
     * @param {IceReport} ice
     * @param {SenderAndReceiverReports} audio
     * @param {SenderAndReceiverReports} video
     */
    function PeerConnectionReport(ice, audio, video) {
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
    PeerConnectionReport.prototype.summarize = function () {
        var senderReports = this.audio.send.concat(this.video.send);
        var send = SenderReport.summarize(senderReports);
        var receiverReports = this.audio.recv.concat(this.video.recv);
        var recv = ReceiverReport.summarize(receiverReports);
        return {
            ice: this.ice,
            send: send,
            recv: recv,
            audio: {
                send: SenderReport.summarize(this.audio.send),
                recv: ReceiverReport.summarize(this.audio.recv)
            },
            video: {
                send: SenderReport.summarize(this.video.send),
                recv: ReceiverReport.summarize(this.video.recv)
            }
        };
    };
    return PeerConnectionReport;
}());
module.exports = PeerConnectionReport;
//# sourceMappingURL=peerconnectionreport.js.map