'use strict';

/**
 * Bandwidth network quality statistics.
 * @property {?number} actual - actual bandwidth, in bytes
 * @property {?number} available - available bandwidth, in bytes
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for bandwidth
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualityBandwidthStats =
/**
 * Construct a {@link NetworkQualityBandwidthStats}.
 * @param {BandwidthStats} bandwidthStats
 */
function NetworkQualityBandwidthStats(_ref) {
  var _ref$actual = _ref.actual,
      actual = _ref$actual === undefined ? null : _ref$actual,
      _ref$available = _ref.available,
      available = _ref$available === undefined ? null : _ref$available,
      _ref$level = _ref.level,
      level = _ref$level === undefined ? null : _ref$level;

  _classCallCheck(this, NetworkQualityBandwidthStats);

  Object.defineProperties(this, {
    actual: {
      value: actual,
      enumerable: true
    },
    available: {
      value: available,
      enumerable: true
    },
    level: {
      value: level,
      enumerable: true
    }
  });
};

module.exports = NetworkQualityBandwidthStats;