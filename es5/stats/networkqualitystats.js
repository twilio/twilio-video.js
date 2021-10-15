'use strict';
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
var NetworkQualityStats = /** @class */ (function () {
    /**
     * Construct a {@link NetworkQualityStats}.
     * @param {NetworkQualityLevels} networkQualityLevels
     */
    function NetworkQualityStats(_a) {
        var level = _a.level, audio = _a.audio, video = _a.video;
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
    }
    return NetworkQualityStats;
}());
module.exports = NetworkQualityStats;
//# sourceMappingURL=networkqualitystats.js.map