'use strict';
var IceReport = require('./icereport');
/**
 * @property {IceReport} lastReport
 * @property {?RTCStats} lastStats
 */
var IceReportFactory = /** @class */ (function () {
    /**
     * Construct an {@link IceReportFactory}.
     */
    function IceReportFactory() {
        Object.defineProperties(this, {
            lastReport: {
                enumerable: true,
                value: new IceReport(0, 0),
                writable: true
            },
            lastStats: {
                enumerable: true,
                value: null,
                writable: true
            }
        });
    }
    /**
     * Create an {@link IceReport}.
     * @param {RTCStats} newerStats;
     * @returns {IceReport}
     */
    IceReportFactory.prototype.next = function (newerStats) {
        var olderStats = this.lastStats;
        this.lastStats = newerStats;
        if (olderStats) {
            var report = olderStats.id === newerStats.id
                ? IceReport.of(olderStats, newerStats)
                : new IceReport(0, 0);
            this.lastReport = report;
        }
        return this.lastReport;
    };
    return IceReportFactory;
}());
module.exports = IceReportFactory;
//# sourceMappingURL=icereportfactory.js.map