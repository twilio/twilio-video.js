'use strict';

/**
 * Calculates the moving average delta for the given samples. A sample (S) consists of
 * a numerator (Sn) and a denominator (Sd). Given the sample size n, the moving average
 * delta is calculated as follows:
 *
 * AvgDelta = Sum((Sn[i] - Sn[i-1]) / (Sd[i] - Sd[i-1])) for all i in [1, n - 1]
 */
class MovingAverageDelta {
  /**
   * Constructor.
   * @param size
   */
  constructor(size) {
    Object.defineProperties(this, {
      _samples: {
        value: [],
      },
      _size: {
        value: size
      }
    });
  }

  /**
   * Get the moving average delta.
   * @returns {number}
   */
  get() {
    const { _samples: samples } = this;
    if (samples.length <= 0) {
      return 0;
    }
    if (samples.length === 1) {
      return Math.round(samples[0].numerator / samples[0].denominator);
    }
    const sampleDifferencesRight = samples.slice(0, samples.length - 1);
    const sampleDifferencesLeft = samples.slice(1);

    const sampleSumDifferences = sampleDifferencesLeft.reduce((sum, sampleDifferenceLeft, i) => {
      const { denominator: denominatorLeft, numerator: numeratorLeft } = sampleDifferenceLeft;
      const { denominator: denominatorRight, numerator: numeratorRight } = sampleDifferencesRight[i];
      const denominatorDifference = denominatorLeft - denominatorRight;
      const numeratorDifference = numeratorLeft - numeratorRight;
      const averageDelta = denominatorDifference > 0 ? (numeratorDifference / denominatorDifference) : 0;
      return sum + averageDelta;
    }, 0);

    return Math.round(sampleSumDifferences / (samples.length - 1));
  }

  /**
   * Put a sample and maybe get rid of the older samples to maintain sample size.
   * @param numerator
   * @param denominator
   */
  putSample(numerator, denominator) {
    const { _samples: samples, _size: size } = this;
    if (samples.length >= size) {
      samples.shift();
    }
    samples.push({ denominator, numerator });
  }
}

module.exports = MovingAverageDelta;
