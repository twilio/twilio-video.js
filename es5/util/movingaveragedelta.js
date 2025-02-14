'use strict';
/**
 * Calculates the moving average delta for the given pair ofsamples. A sample (S)
 * consists of a numerator (Sn) and a denominator (Sd).The moving average delta is
 * calculated as follows:
 *
 * MovingAvgDelta = (Sn[1] - Sn[0]) / (Sd[1] - Sd[0])
 */
var MovingAverageDelta = /** @class */ (function () {
    /**
     * Constructor.
     */
    function MovingAverageDelta() {
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
    MovingAverageDelta.prototype.get = function () {
        var samples = this._samples;
        var denominatorDelta = (samples[1].denominator - samples[0].denominator) || Infinity;
        var numeratorDelta = samples[1].numerator - samples[0].numerator;
        return numeratorDelta / denominatorDelta;
    };
    /**
     * Put a sample and get rid of the older sample to maintain sample size of 2.
     * @param numerator
     * @param denominator
     */
    MovingAverageDelta.prototype.putSample = function (numerator, denominator) {
        var samples = this._samples;
        samples.shift();
        samples.push({ denominator: denominator, numerator: numerator });
    };
    return MovingAverageDelta;
}());
module.exports = MovingAverageDelta;
//# sourceMappingURL=movingaveragedelta.js.map