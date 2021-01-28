'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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

var ReceiverReport = function (_SenderOrReceiverRepo) {
  _inherits(ReceiverReport, _SenderOrReceiverRepo);

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
    _classCallCheck(this, ReceiverReport);

    var _this = _possibleConstructorReturn(this, (ReceiverReport.__proto__ || Object.getPrototypeOf(ReceiverReport)).call(this, id, trackId, bitrate));

    var phonyFractionLost = deltaPacketsReceived > 0 ? deltaPacketsLost / deltaPacketsReceived : 0;
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


  _createClass(ReceiverReport, [{
    key: 'summarize',


    /**
     * Summarize the {@link ReceiveReport}.
     * @returns {ReceiverSummary}
     */
    value: function summarize() {
      return {
        bitrate: this.bitrate,
        fractionLost: typeof this.fractionLost === 'number' ? this.fractionLost : this.phonyFractionLost,
        jitter: this.jitter
      };
    }
  }], [{
    key: 'of',
    value: function of(trackId, olderStats, newerStats) {
      if (olderStats.id !== newerStats.id) {
        throw new Error('RTCStats IDs must match');
      }
      var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
      var deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
      var bitrate = secondsElapsed > 0 ? deltaBytesReceived / secondsElapsed * 8 : 0;
      var deltaPacketsLost = Math.max(newerStats.packetsLost - olderStats.packetsLost, 0);
      var deltaPacketsReceived = newerStats.packetsReceived - olderStats.packetsReceived;
      var fractionLost = newerStats.fractionLost,
          jitter = newerStats.jitter;

      return new ReceiverReport(olderStats.id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter);
    }

    /**
     * Summarize {@link ReceiverReport}s by summing and averaging their values.
     * @param {Array<ReceiverReport>} reports
     * @returns {ReceiverSummary}
     */

  }, {
    key: 'summarize',
    value: function summarize(reports) {
      var summaries = reports.map(function (report) {
        return report.summarize();
      });
      var bitrate = sum(summaries.map(function (summary) {
        return summary.bitrate;
      }));
      var fractionLost = average(summaries.map(function (summary) {
        return summary.fractionLost;
      }));
      var jitter = average(summaries.map(function (summary) {
        return summary.jitter;
      }));
      return {
        bitrate: bitrate,
        fractionLost: fractionLost,
        jitter: jitter
      };
    }
  }]);

  return ReceiverReport;
}(SenderOrReceiverReport);

module.exports = ReceiverReport;