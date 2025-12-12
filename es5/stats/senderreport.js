/* eslint no-undefined:0 */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var average = require('./average');
var SenderOrReceiverReport = require('./senderorreceiverreport');
var sum = require('./sum');
/**
 * @interface SenderSummary
 * @property {number} bitrate
 * @property {number} [rtt] - s (undefined in Chrome)
 */
/**
 * @extends SenderOrReceiverReport
 * @property {number} [rtt] - s (undefined in Chrome)
 */
var SenderReport = /** @class */ (function (_super) {
    __extends(SenderReport, _super);
    /**
     * Construct a {@link SenderReport}.
     * @param {StatsId} id
     * @param {TrackId} trackId
     * @param {number} bitrate - bps
     * @param {number} [rtt] - s
     */
    function SenderReport(id, trackId, bitrate, rtt) {
        var _this = _super.call(this, id, trackId, bitrate) || this;
        Object.defineProperties(_this, {
            rtt: {
                enumerable: true,
                value: rtt
            }
        });
        return _this;
    }
    /**
     * Create a {@link SenderReport}.
     * @param {string} trackId
     * @param {RTCStats} olderStats
     * @param {RTCStats} newerStats
     * @param {RTCRemoteInboundRtpStreamStats} [newerRemoteStats]
     * @returns {SenderReport}
     */
    SenderReport.of = function (trackId, olderStats, newerStats, newerRemoteStats) {
        if (olderStats.id !== newerStats.id) {
            throw new Error('RTCStats IDs must match');
        }
        var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
        var deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
        var bitrate = secondsElapsed > 0
            ? (deltaBytesSent / secondsElapsed) * 8
            : 0;
        var rtt = newerRemoteStats && typeof newerRemoteStats.roundTripTime === 'number'
            ? newerRemoteStats.roundTripTime / 1000
            : undefined;
        return new SenderReport(olderStats.id, trackId, bitrate, rtt);
    };
    /**
     * Summarize {@link SenderReport}s by summing and averaging their values.
     * @param {Array<SenderReport>} reports
     * @returns {SenderSummary}
     */
    SenderReport.summarize = function (reports) {
        var bitrate = sum(reports.map(function (report) { return report.bitrate; }));
        var rtt = average(reports.map(function (report) { return report.rtt; }));
        return {
            bitrate: bitrate,
            rtt: rtt
        };
    };
    return SenderReport;
}(SenderOrReceiverReport));
module.exports = SenderReport;
//# sourceMappingURL=senderreport.js.map