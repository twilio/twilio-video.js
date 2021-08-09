'use strict';

/**
 * Calculates the moving average delta for the given pair ofsamples. A sample (S)
 * consists of a numerator (Sn) and a denominator (Sd).The moving average delta is
 * calculated as follows:
 *
 * MovingAvgDelta = (Sn[1] - Sn[0]) / (Sd[1] - Sd[0])
 */
class MovingAverageDelta {
  /**
   * Constructor.
   */
  constructor() {
    Object.defineProperties(this, {
      _samples: {
        value: [
          { denominator: 0, numerator: 0 },
          { denominator: 0, numerator: 0 }
        ],
      }
    });
  }

  /**
   * Get the moving average delta.
   * @returns {number}
   */
  get() {
    const { _samples: samples } = this;
    const denominatorDelta = (samples[1].denominator - samples[0].denominator) || Infinity;
    const numeratorDelta = samples[1].numerator - samples[0].numerator;
    return numeratorDelta / denominatorDelta;
  }

  /**
   * Put a sample and get rid of the older sample to maintain sample size of 2.
   * @param numerator
   * @param denominator
   */
  putSample(numerator, denominator) {
    const { _samples: samples } = this;
    samples.shift();
    samples.push({ denominator, numerator });
  }
}

module.exports = MovingAverageDelta;
