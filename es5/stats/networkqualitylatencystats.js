'use strict';

/**
 * Latency network quality statistics.
 * @property {?number} jitter - media jitter in seconds
 * @property {?number} rtt - round trip time in seconds
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for latency
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualityLatencyStats =
/**
 * Construct a {@link NetworkQualityLatencyStats}.
 * @param {LatencyStats} latencyStats
 */
function NetworkQualityLatencyStats(_ref) {
  var _ref$jitter = _ref.jitter,
      jitter = _ref$jitter === undefined ? null : _ref$jitter,
      _ref$rtt = _ref.rtt,
      rtt = _ref$rtt === undefined ? null : _ref$rtt,
      _ref$level = _ref.level,
      level = _ref$level === undefined ? null : _ref$level;

  _classCallCheck(this, NetworkQualityLatencyStats);

  Object.defineProperties(this, {
    jitter: {
      value: jitter,
      enumerable: true
    },
    rtt: {
      value: rtt,
      enumerable: true
    },
    level: {
      value: level,
      enumerable: true
    }
  });
};

module.exports = NetworkQualityLatencyStats;