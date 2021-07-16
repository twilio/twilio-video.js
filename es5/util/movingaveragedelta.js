'use strict';

/**
 * Calculates the moving average delta for the given pair ofsamples. A sample (S)
 * consists of a numerator (Sn) and a denominator (Sd).The moving average delta is
 * calculated as follows:
 *
 * MovingAvgDelta = (Sn[1] - Sn[0]) / (Sd[1] - Sd[0])
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MovingAverageDelta = function () {
  /**
   * Constructor.
   */
  function MovingAverageDelta() {
    _classCallCheck(this, MovingAverageDelta);

    Object.defineProperties(this, {
      _samples: {
        value: [{ denominator: 0, numerator: 0 }, { denominator: 0, numerator: 0 }]
      }
    });
  }

  /**
   * Get the moving average delta.
   * @returns {number}
   */


  _createClass(MovingAverageDelta, [{
    key: 'get',
    value: function get() {
      var samples = this._samples;

      var denominatorDelta = samples[1].denominator - samples[0].denominator || Infinity;
      var numeratorDelta = samples[1].numerator - samples[0].numerator;
      return Math.round(numeratorDelta / denominatorDelta);
    }

    /**
     * Put a sample and get rid of the older sample to maintain sample size of 2.
     * @param numerator
     * @param denominator
     */

  }, {
    key: 'putSample',
    value: function putSample(numerator, denominator) {
      var samples = this._samples;

      samples.shift();
      samples.push({ denominator: denominator, numerator: numerator });
    }
  }]);

  return MovingAverageDelta;
}();

module.exports = MovingAverageDelta;