'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ReceiverReport = require('./receiverreport');
var SenderOrReceiverReportFactory = require('./senderorreceiverreportfactory');

/**
 * @extends SenderOrReceiverReportFactory
 * @param {?ReceiverReport} lastReport
 */

var ReceiverReportFactory = function (_SenderOrReceiverRepo) {
  _inherits(ReceiverReportFactory, _SenderOrReceiverRepo);

  /**
   * Construct a {@link ReceiverReportFactory}.
   * @param {TrackId} trackId
   * @param {RTCStats} initialStats
   */
  function ReceiverReportFactory(trackId, initialStats) {
    _classCallCheck(this, ReceiverReportFactory);

    var _this = _possibleConstructorReturn(this, (ReceiverReportFactory.__proto__ || Object.getPrototypeOf(ReceiverReportFactory)).call(this, initialStats.id, trackId, initialStats));

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


  _createClass(ReceiverReportFactory, [{
    key: 'next',
    value: function next(trackId, newerStats) {
      var olderStats = this.lastStats;
      this.lastStats = newerStats;
      this.trackId = trackId;
      var report = ReceiverReport.of(trackId, olderStats, newerStats);
      this.lastReport = report;
      return report;
    }
  }]);

  return ReceiverReportFactory;
}(SenderOrReceiverReportFactory);

module.exports = ReceiverReportFactory;