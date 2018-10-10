'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IceReport = require('./icereport');

/**
 * @property {IceReport} lastReport
 * @property {?RTCStats} lastStats
 */

var IceReportFactory = function () {
  /**
   * Construct an {@link IceReportFactory}.
   */
  function IceReportFactory() {
    _classCallCheck(this, IceReportFactory);

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


  _createClass(IceReportFactory, [{
    key: 'next',
    value: function next(newerStats) {
      var olderStats = this.lastStats;
      this.lastStats = newerStats;
      if (olderStats) {
        var report = olderStats.id === newerStats.id ? IceReport.of(olderStats, newerStats) : new IceReport(0, 0);
        this.lastReport = report;
      }
      return this.lastReport;
    }
  }]);

  return IceReportFactory;
}();

module.exports = IceReportFactory;