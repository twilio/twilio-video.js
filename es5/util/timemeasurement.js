'use strict';

/**
 * Measurement of elapsed time
 * @property {number} start - start time in milliseconds.
 * @property {?number} end - end time in milliseconds.
 * @property {?number} duration - duration in milliseconds.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TimeMeasurement = function () {
  /**
   * Construct and starts {@link TimeMeasurement}.
   */
  function TimeMeasurement() {
    _classCallCheck(this, TimeMeasurement);

    Object.defineProperties(this, {
      start: {
        enumerable: true,
        value: Date.now()
      },
      end: {
        enumerable: true,
        value: null,
        writable: true
      },
      duration: {
        enumerable: true,
        get: function get() {
          if (this.end) {
            return this.end - this.start;
          }
          // eslint-disable-next-line no-undefined
          return undefined;
        }
      }
    });
  }

  /**
   * Returns the timing values
   * @returns {EncodingParameters}
   */


  _createClass(TimeMeasurement, [{
    key: 'toJSON',
    value: function toJSON() {
      return {
        start: this.start,
        end: this.end,
        duration: this.duration
      };
    }

    /**
     * stops the {@link TimeMeasurement}.
     */

  }, {
    key: 'stop',
    value: function stop() {
      this.end = Date.now();
      return this.duration;
    }
  }]);

  return TimeMeasurement;
}();

module.exports = TimeMeasurement;