'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * {@link NetworkQualityMediaStats} for a {@link Participant}'s audio.
 */

var NetworkQualityAudioStats = function (_NetworkQualityMediaS) {
  _inherits(NetworkQualityAudioStats, _NetworkQualityMediaS);

  /**
   * Construct a {@link NetworkQualityAudioStats}.
   * @param {MediaLevels} mediaLevels
   */
  function NetworkQualityAudioStats(mediaLevels) {
    _classCallCheck(this, NetworkQualityAudioStats);

    return _possibleConstructorReturn(this, (NetworkQualityAudioStats.__proto__ || Object.getPrototypeOf(NetworkQualityAudioStats)).call(this, mediaLevels));
  }

  return NetworkQualityAudioStats;
}(NetworkQualityMediaStats);

module.exports = NetworkQualityAudioStats;