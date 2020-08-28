'use strict';

/**
 * Measurement of elapsed time
 * @property {number} start - start time in milliseconds.
 * @property {?number} end - end time in milliseconds.
 * @property {?number} duration - duration in milliseconds.
 */
class TimeMeasurement {
  /**
   * Construct and starts {@link TimeMeasurement}.
   */
  constructor() {
    Object.defineProperties(this, {
      start: {
        enumerable: true,
        value: Date.now(),
      },
      end: {
        enumerable: true,
        value: null,
        writable: true
      },
      duration: {
        enumerable: true,
        get() {
          if (this.end) {
            return this.end - this.start;
          }
          // eslint-disable-next-line no-undefined
          return undefined;
        }
      },
    });
  }

  /**
   * stops the {@link TimeMeasurement}.
   */
  stop() {
    this.end = Date.now();
    return this.duration;
  }
}

module.exports = TimeMeasurement;
