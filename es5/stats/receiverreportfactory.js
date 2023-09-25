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
var ReceiverReport = require('./receiverreport');
var SenderOrReceiverReportFactory = require('./senderorreceiverreportfactory');
/**
 * @extends SenderOrReceiverReportFactory
 * @param {?ReceiverReport} lastReport
 */
var ReceiverReportFactory = /** @class */ (function (_super) {
    __extends(ReceiverReportFactory, _super);
    /**
     * Construct a {@link ReceiverReportFactory}.
     * @param {TrackId} trackId
     * @param {RTCStats} initialStats
     */
    function ReceiverReportFactory(trackId, initialStats) {
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
     * Create a {@link ReceiverReport}.
     * @param {TrackId} trackId
     * @param {RTCStats} newerStats
     * @returns {ReceiverReport}
     */
    ReceiverReportFactory.prototype.next = function (trackId, newerStats) {
        var olderStats = this.lastStats;
        this.lastStats = newerStats;
        this.trackId = trackId;
        var report = ReceiverReport.of(trackId, olderStats, newerStats);
        this.lastReport = report;
        return report;
    };
    return ReceiverReportFactory;
}(SenderOrReceiverReportFactory));
module.exports = ReceiverReportFactory;
//# sourceMappingURL=receiverreportfactory.js.map