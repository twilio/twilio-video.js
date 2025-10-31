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
var ReceiverReport = /** @class */ (function (_super) {
    __extends(ReceiverReport, _super);
    /**
     * @param {StatsId} id
     * @param {TrackId} trackId
     * @param {number} bitrate - bps
     * @param {number} deltaPacketsLost
     * @param {number} deltaPacketsReceived
     * @param {number} [fractionLost] - 0–1 (undefined in Firefox)
     * @param {number} [jitter] - s (undefined for video tracks in Chrome)
     */
    function ReceiverReport(id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter) {
        var _this = _super.call(this, id, trackId, bitrate) || this;
        var phonyFractionLost = deltaPacketsReceived > 0
            ? deltaPacketsLost / deltaPacketsReceived
            : 0;
        Object.defineProperties(_this, {
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
        return _this;
    }
    /**
     * Create a {@link ReceiverReport}.
     * @param {string} trackId
     * @param {RTCStats} olderStats
     * @param {RTCStats} newerStats
     * @returns {ReceiverReport}
     */
    ReceiverReport.of = function (trackId, olderStats, newerStats) {
        if (olderStats.id !== newerStats.id) {
            throw new Error('RTCStats IDs must match');
        }
        var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
        var deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
        var bitrate = secondsElapsed > 0
            ? (deltaBytesReceived / secondsElapsed) * 8
            : 0;
        var deltaPacketsLost = Math.max(newerStats.packetsLost - olderStats.packetsLost, 0);
        var deltaPacketsReceived = newerStats.packetsReceived - olderStats.packetsReceived;
        var fractionLost = newerStats.fractionLost, jitter = newerStats.jitter;
        return new ReceiverReport(olderStats.id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter);
    };
    /**
     * Summarize {@link ReceiverReport}s by summing and averaging their values.
     * @param {Array<ReceiverReport>} reports
     * @returns {ReceiverSummary}
     */
    ReceiverReport.summarize = function (reports) {
        var summaries = reports.map(function (report) { return report.summarize(); });
        var bitrate = sum(summaries.map(function (summary) { return summary.bitrate; }));
        var fractionLost = average(summaries.map(function (summary) { return summary.fractionLost; }));
        var jitter = average(summaries.map(function (summary) { return summary.jitter; }));
        return {
            bitrate: bitrate,
            fractionLost: fractionLost,
            jitter: jitter
        };
    };
    /**
     * Summarize the {@link ReceiveReport}.
     * @returns {ReceiverSummary}
     */
    ReceiverReport.prototype.summarize = function () {
        return {
            bitrate: this.bitrate,
            fractionLost: typeof this.fractionLost === 'number' ? this.fractionLost : this.phonyFractionLost,
            jitter: this.jitter
        };
    };
    return ReceiverReport;
}(SenderOrReceiverReport));
module.exports = ReceiverReport;
//# sourceMappingURL=receiverreport.js.map