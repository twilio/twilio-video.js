'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackStats = require('./trackstats');

/**
 * Statistics for a remote {@link Track}.
 * @extends TrackStats
 * @property {?number} bytesReceived - Number of bytes received
 * @property {?number} packetsReceived - Number of packets received
 */

var RemoteTrackStats = function (_TrackStats) {
  _inherits(RemoteTrackStats, _TrackStats);

  /*
   * @param {string} trackId - {@link Track} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  function RemoteTrackStats(trackId, statsReport) {
    _classCallCheck(this, RemoteTrackStats);

    var _this = _possibleConstructorReturn(this, (RemoteTrackStats.__proto__ || Object.getPrototypeOf(RemoteTrackStats)).call(this, trackId, statsReport));

    Object.defineProperties(_this, {
      bytesReceived: {
        value: typeof statsReport.bytesReceived === 'number' ? statsReport.bytesReceived : null,
        enumerable: true
      },
      packetsReceived: {
        value: typeof statsReport.packetsReceived === 'number' ? statsReport.packetsReceived : null,
        enumerable: true
      }
    });
    return _this;
  }

  return RemoteTrackStats;
}(TrackStats);

module.exports = RemoteTrackStats;