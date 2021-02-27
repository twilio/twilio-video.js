'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualityAudioStats = require('./networkqualityaudiostats');
var NetworkQualityVideoStats = require('./networkqualityvideostats');

/**
 * Network quality statistics for a {@link Participant}.
 * @property {NetworkQualityLevel} level - {@link NetworkQualityLevel} of the {@link Participant}
 * @property {?NetworkQualityAudioStats} audio - {@link NetworkQualityMediaStats}
 *   for audio; <code>null</code> if {@link NetworkQualityVerbosity} is {@link NetworkQualityVerbosity}<code style="padding:0 0">#minimal</code>
 *   or below
 * @property {?NetworkQualityVideoStats} video - {@link NetworkQualityMediaStats}
 *   for video; <code>null</code> if {@link NetworkQualityVerbosity} is {@link NetworkQualityVerbosity}<code style="padding:0 0">#minimal</code>
 *   or below
 */

var NetworkQualityStats =
/**
 * Construct a {@link NetworkQualityStats}.
 * @param {NetworkQualityLevels} networkQualityLevels
 */
function NetworkQualityStats(_ref) {
  var level = _ref.level,
      audio = _ref.audio,
      video = _ref.video;

  _classCallCheck(this, NetworkQualityStats);

  Object.defineProperties(this, {
    level: {
      value: level,
      enumerable: true
    },
    audio: {
      value: audio ? new NetworkQualityAudioStats(audio) : null,
      enumerable: true
    },
    video: {
      value: video ? new NetworkQualityVideoStats(video) : null,
      enumerable: true
    }
  });
};

module.exports = NetworkQualityStats;