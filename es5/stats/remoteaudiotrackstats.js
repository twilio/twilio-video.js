'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for an {@link AudioTrack}.
 * @extends RemoteTrackStats
 * @property {?AudioLevel} audioLevel - Output {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 */

var RemoteAudioTrackStats = function (_RemoteTrackStats) {
  _inherits(RemoteAudioTrackStats, _RemoteTrackStats);

  /**
   * @param {string} trackId - {@link AudioTrack} ID
   * @param {StandardizedTrackStatsReport} statsReport
   */
  function RemoteAudioTrackStats(trackId, statsReport) {
    _classCallCheck(this, RemoteAudioTrackStats);

    var _this = _possibleConstructorReturn(this, (RemoteAudioTrackStats.__proto__ || Object.getPrototypeOf(RemoteAudioTrackStats)).call(this, trackId, statsReport));

    Object.defineProperties(_this, {
      audioLevel: {
        value: typeof statsReport.audioOutputLevel === 'number' ? statsReport.audioOutputLevel : null,
        enumerable: true
      },
      jitter: {
        value: typeof statsReport.jitter === 'number' ? statsReport.jitter : null,
        enumerable: true
      }
    });
    return _this;
  }

  return RemoteAudioTrackStats;
}(RemoteTrackStats);

module.exports = RemoteAudioTrackStats;