'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalAudioTrack}.
 * @extends LocalTrackStats
 * @property {?AudioLevel} audioLevel - Input {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 */

var LocalAudioTrackStats = function (_LocalTrackStats) {
  _inherits(LocalAudioTrackStats, _LocalTrackStats);

  /**
   * @param {string} trackId - {@link LocalAudioTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  function LocalAudioTrackStats(trackId, statsReport) {
    _classCallCheck(this, LocalAudioTrackStats);

    var _this = _possibleConstructorReturn(this, (LocalAudioTrackStats.__proto__ || Object.getPrototypeOf(LocalAudioTrackStats)).call(this, trackId, statsReport));

    Object.defineProperties(_this, {
      audioLevel: {
        value: typeof statsReport.audioInputLevel === 'number' ? statsReport.audioInputLevel : null,
        enumerable: true
      },
      jitter: {
        value: typeof statsReport.jitter === 'number' ? statsReport.jitter : null,
        enumerable: true
      }
    });
    return _this;
  }

  return LocalAudioTrackStats;
}(LocalTrackStats);

/**
 * The maximum absolute amplitude of a set of audio samples in the
 * range of 0 to 32767 inclusive.
 * @typedef {number} AudioLevel
 */

module.exports = LocalAudioTrackStats;