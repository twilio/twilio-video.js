'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NetworkQualityMediaStats = require('./networkqualitymediastats');

/**
 * {@link NetworkQualityMediaStats} for a {@link Participant}'s video.
 */

var NetworkQualityVideoStats = function (_NetworkQualityMediaS) {
  _inherits(NetworkQualityVideoStats, _NetworkQualityMediaS);

  /**
   * Construct a {@link NetworkQualityVideoStats}.
   * @param {MediaLevels} mediaLevels
   */
  function NetworkQualityVideoStats(mediaLevels) {
    _classCallCheck(this, NetworkQualityVideoStats);

    return _possibleConstructorReturn(this, (NetworkQualityVideoStats.__proto__ || Object.getPrototypeOf(NetworkQualityVideoStats)).call(this, mediaLevels));
  }

  return NetworkQualityVideoStats;
}(NetworkQualityMediaStats);

module.exports = NetworkQualityVideoStats;