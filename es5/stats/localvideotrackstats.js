'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalVideoTrack}.
 * @extends LocalTrackStats
 * @property {?VideoTrack#Dimensions} captureDimensions - Video capture resolution
 * @property {?VideoTrack#Dimensions} dimensions - Video encoding resolution
 * @property {?number} captureFrameRate - Video capture frame rate
 * @property {?number} frameRate - Video encoding frame rate
 */

var LocalVideoTrackStats = function (_LocalTrackStats) {
  _inherits(LocalVideoTrackStats, _LocalTrackStats);

  /**
   * @param {string} trackId - {@link LocalVideoTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   * @param {boolean} prepareForInsights
   */
  function LocalVideoTrackStats(trackId, statsReport, prepareForInsights) {
    _classCallCheck(this, LocalVideoTrackStats);

    var _this = _possibleConstructorReturn(this, (LocalVideoTrackStats.__proto__ || Object.getPrototypeOf(LocalVideoTrackStats)).call(this, trackId, statsReport, prepareForInsights));

    var captureDimensions = null;
    if (typeof statsReport.frameWidthInput === 'number' && typeof statsReport.frameHeightInput === 'number') {
      captureDimensions = {};

      Object.defineProperties(captureDimensions, {
        width: {
          value: statsReport.frameWidthInput,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightInput,
          enumerable: true
        }
      });
    }

    var dimensions = null;
    if (typeof statsReport.frameWidthSent === 'number' && typeof statsReport.frameHeightSent === 'number') {
      dimensions = {};

      Object.defineProperties(dimensions, {
        width: {
          value: statsReport.frameWidthSent,
          enumerable: true
        },
        height: {
          value: statsReport.frameHeightSent,
          enumerable: true
        }
      });
    }

    Object.defineProperties(_this, {
      captureDimensions: {
        value: captureDimensions,
        enumerable: true
      },
      dimensions: {
        value: dimensions,
        enumerable: true
      },
      captureFrameRate: {
        value: typeof statsReport.frameRateInput === 'number' ? statsReport.frameRateInput : null,
        enumerable: true
      },
      frameRate: {
        value: typeof statsReport.frameRateSent === 'number' ? statsReport.frameRateSent : null,
        enumerable: true
      }
    });
    return _this;
  }

  return LocalVideoTrackStats;
}(LocalTrackStats);

module.exports = LocalVideoTrackStats;