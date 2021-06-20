'use strict';

/**
 * Fraction lost network quality statistics.
 * @property {?number} fractionLost - packets lost
 * @property {?NetworkQualityLevel} level - {@link NetworkQualityLevel} for fraction lost
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualityFractionLostStats =
/**
 * Construct a {@link NetworkQualityFractionLostStats}.
 * @param {FractionLostStats} fractionLostStats
 */
function NetworkQualityFractionLostStats(_ref) {
  var _ref$fractionLost = _ref.fractionLost,
      fractionLost = _ref$fractionLost === undefined ? null : _ref$fractionLost,
      _ref$level = _ref.level,
      level = _ref$level === undefined ? null : _ref$level;

  _classCallCheck(this, NetworkQualityFractionLostStats);

  Object.defineProperties(this, {
    fractionLost: {
      value: fractionLost,
      enumerable: true
    },
    level: {
      value: level,
      enumerable: true
    }
  });
};

module.exports = NetworkQualityFractionLostStats;