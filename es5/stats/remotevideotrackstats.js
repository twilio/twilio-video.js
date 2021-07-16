'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for a {@link VideoTrack}.
 * @extends RemoteTrackStats
 * @property {?VideoTrack#Dimensions} dimensions - Received video resolution
 * @property {?number} frameRate - Received video frame rate
 */

var RemoteVideoTrackStats = function (_RemoteTrackStats) {
  _inherits(RemoteVideoTrackStats, _RemoteTrackStats);

  /**
   * @param {string} trackId - {@link VideoTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  function RemoteVideoTrackStats(trackId, statsReport) {
    _classCallCheck(this, RemoteVideoTrackStats);

    var _this = _possibleConstructorReturn(this, (RemoteVideoTrackStats.__proto__ || Object.getPrototypeOf(RemoteVideoTrackStats)).call(this, trackId, statsReport));

    var dimensions = null;
    if (typeof statsReport.frameWidthReceived === 'number' && typeof statsReport.frameHeightReceived === 'number') {
      dimensions = {};

      Object.defineProperties(dimensions, {
        width: {
          value: statsReport.frameWidthReceived,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightReceived,
          enumerable: true
        }
      });
    }

    Object.defineProperties(_this, {
      dimensions: {
        value: dimensions,
        enumerable: true
      },
      frameRate: {
        value: typeof statsReport.frameRateReceived === 'number' ? statsReport.frameRateReceived : null,
        enumerable: true
      }
    });
    return _this;
  }

  return RemoteVideoTrackStats;
}(RemoteTrackStats);

module.exports = RemoteVideoTrackStats;