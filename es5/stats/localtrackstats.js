'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackStats = require('./trackstats');

/**
 * Statistics for a {@link LocalTrack}.
 * @extends TrackStats
 * @property {?number} bytesSent - Number of bytes sent
 * @property {?number} packetsSent - Number of packets sent
 * @property {?number} roundTripTime - Round trip time in milliseconds
 */

var LocalTrackStats = function (_TrackStats) {
  _inherits(LocalTrackStats, _TrackStats);

  /**
   * @param {string} trackId - {@link LocalTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   * @param {boolean} prepareForInsights
   */
  function LocalTrackStats(trackId, statsReport, prepareForInsights) {
    _classCallCheck(this, LocalTrackStats);

    var _this = _possibleConstructorReturn(this, (LocalTrackStats.__proto__ || Object.getPrototypeOf(LocalTrackStats)).call(this, trackId, statsReport));

    Object.defineProperties(_this, {
      bytesSent: {
        value: typeof statsReport.bytesSent === 'number' ? statsReport.bytesSent : prepareForInsights ? 0 : null,
        enumerable: true
      },
      packetsSent: {
        value: typeof statsReport.packetsSent === 'number' ? statsReport.packetsSent : prepareForInsights ? 0 : null,
        enumerable: true
      },
      roundTripTime: {
        value: typeof statsReport.roundTripTime === 'number' ? statsReport.roundTripTime : prepareForInsights ? 0 : null,
        enumerable: true
      }
    });
    return _this;
  }

  return LocalTrackStats;
}(TrackStats);

module.exports = LocalTrackStats;