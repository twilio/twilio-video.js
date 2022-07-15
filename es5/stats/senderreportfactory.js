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
var SenderOrReceiverReportFactory = require('./senderorreceiverreportfactory');
var SenderReport = require('./senderreport');
/**
 * @extends {SenderOrReceiverReportFactory}
 * @property {?SenderReport} lastReport
 */
var SenderReportFactory = /** @class */ (function (_super) {
    __extends(SenderReportFactory, _super);
    /**
     * Construct a {@link SenderReportFactory}.
     * @param {TrackId} trackId
     * @param {RTCStats} initialStats
     */
    function SenderReportFactory(trackId, initialStats) {
        var _this = _super.call(this, initialStats.id, trackId, initialStats) || this;
        Object.defineProperties(_this, {
            lastReport: {
                enumerable: true,
                value: null,
                writable: true
            }
        });
        return _this;
    }
    /**
     * @param {TrackId} trackId
     * @param {RTCStats} newerStats
     * @param {RTCRemoteInboundRtpStreamStats} [newerRemoteStats]
     * @returns {SenderReport}
     */
    SenderReportFactory.prototype.next = function (trackId, newerStats, newerRemoteStats) {
        var olderStats = this.lastStats;
        this.lastStats = newerStats;
        this.trackId = trackId;
        var report = SenderReport.of(trackId, olderStats, newerStats, newerRemoteStats);
        this.lastReport = report;
        return report;
    };
    return SenderReportFactory;
}(SenderOrReceiverReportFactory));
module.exports = SenderReportFactory;
//# sourceMappingURL=senderreportfactory.js.map