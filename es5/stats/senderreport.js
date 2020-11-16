/* eslint no-undefined:0 */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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

var SenderReport = function (_SenderOrReceiverRepo) {
  _inherits(SenderReport, _SenderOrReceiverRepo);

  /**
   * Construct a {@link SenderReport}.
   * @param {StatsId} id
   * @param {TrackId} trackId
   * @param {number} bitrate - bps
   * @param {number} [rtt] - s
   */
  function SenderReport(id, trackId, bitrate, rtt) {
    _classCallCheck(this, SenderReport);

    var _this = _possibleConstructorReturn(this, (SenderReport.__proto__ || Object.getPrototypeOf(SenderReport)).call(this, id, trackId, bitrate));

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


  _createClass(SenderReport, null, [{
    key: 'of',
    value: function of(trackId, olderStats, newerStats, newerRemoteStats) {
      if (olderStats.id !== newerStats.id) {
        throw new Error('RTCStats IDs must match');
      }
      var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
      var deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
      var bitrate = secondsElapsed > 0 ? deltaBytesSent / secondsElapsed * 8 : 0;
      var rtt = newerRemoteStats && typeof newerRemoteStats.roundTripTime === 'number' ? newerRemoteStats.roundTripTime / 1000 : undefined;
      return new SenderReport(olderStats.id, trackId, bitrate, rtt);
    }

    /**
     * Summarize {@link SenderReport}s by summing and averaging their values.
     * @param {Array<SenderReport>} reports
     * @returns {SenderSummary}
     */

  }, {
    key: 'summarize',
    value: function summarize(reports) {
      var bitrate = sum(reports.map(function (report) {
        return report.bitrate;
      }));
      var rtt = average(reports.map(function (report) {
        return report.rtt;
      }));
      return {
        bitrate: bitrate,
        rtt: rtt
      };
    }
  }]);

  return SenderReport;
}(SenderOrReceiverReport);

module.exports = SenderReport;