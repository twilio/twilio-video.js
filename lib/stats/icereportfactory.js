'use strict';

const IceReport = require('./icereport');

/**
 * @property {IceReport} lastReport
 * @property {?RTCStats} lastStats
 */
class IceReportFactory {
  /**
   * Construct an {@link IceReportFactory}.
   */
  constructor() {
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
  next(newerStats) {
    const olderStats = this.lastStats;
    this.lastStats = newerStats;
    if (olderStats) {
      const report = olderStats.id === newerStats.id
        ? IceReport.of(olderStats, newerStats)
        : new IceReport(0, 0);
      this.lastReport = report;
    }
    return this.lastReport;
  }
}

module.exports = IceReportFactory;
