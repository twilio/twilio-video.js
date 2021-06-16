'use strict';

/**
 * @property {number} [availableSend] - bps (undefined in Firefox)
 * @property {number} recv - bps
 * @property {number} [rtt] - s (undefined in Firefox)
 * @property {number} send - bps
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IceReport = function () {
  /**
   * Construct an {@link IceReport}.
   * @param {number} send - bps
   * @param {number} recv - bps
   * @param {number} [rtt] - s
   * @param {number} [availableSend] - bps
   */
  function IceReport(send, recv, availableSend, rtt) {
    _classCallCheck(this, IceReport);

    Object.defineProperties(this, {
      availableSend: {
        enumerable: true,
        value: availableSend
      },
      recv: {
        enumerable: true,
        value: recv
      },
      rtt: {
        enumerable: true,
        value: rtt
      },
      send: {
        enumerable: true,
        value: send
      }
    });
  }

  /**
   * @param {RTCStats} olderStats
   * @param {RTCStats} newerStats
   * @returns {IceReport}
   */


  _createClass(IceReport, null, [{
    key: 'of',
    value: function of(olderStats, newerStats) {
      var secondsElapsed = (newerStats.timestamp - olderStats.timestamp) / 1000;
      var deltaBytesSent = newerStats.bytesSent - olderStats.bytesSent;
      var deltaBytesReceived = newerStats.bytesReceived - olderStats.bytesReceived;
      var send = secondsElapsed > 0 ? deltaBytesSent / secondsElapsed * 8 : 0;
      var recv = secondsElapsed > 0 ? deltaBytesReceived / secondsElapsed * 8 : 0;
      var availableSend = newerStats.availableOutgoingBitrate,
          rtt = newerStats.currentRoundTripTime;

      return new IceReport(send, recv, availableSend, rtt);
    }
  }]);

  return IceReport;
}();

module.exports = IceReport;