'use strict';
/**
 * @property {number} [availableSend] - bps (undefined in Firefox)
 * @property {number} recv - bps
 * @property {number} [rtt] - s (undefined in Firefox)
 * @property {number} send - bps
 */
var IceReport = /** @class */ (function () {
    /**
     * Construct an {@link IceReport}.
     * @param {number} send - bps
     * @param {number} recv - bps
     * @param {number} [rtt] - s
     * @param {number} [availableSend] - bps
     */
    function IceReport(send, recv, availableSend, rtt) {
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
    IceReport.of = function (olderStats, newerStats) {
        var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
        var deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
        var deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
        var send = secondsElapsed > 0
            ? (deltaBytesSent / secondsElapsed) * 8
            : 0;
        var recv = secondsElapsed > 0
            ? (deltaBytesReceived / secondsElapsed) * 8
            : 0;
        var availableSend = newerStats.availableOutgoingBitrate, rtt = newerStats.currentRoundTripTime;
        return new IceReport(send, recv, availableSend, rtt);
    };
    return IceReport;
}());
module.exports = IceReport;
//# sourceMappingURL=icereport.js.map