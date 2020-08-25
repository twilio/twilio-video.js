'use strict';

/**
 * A {@link TimeMeasurement} helps measure elapsed time
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
          const current = this.end || Date.now();
          return current - this.start;
        }
      },
    });
  }

  /**
   * stops the {@link TimeMeasurement}.
   * @returns {number} duration
   */
  stop() {
    this.end = Date.now();
    return this.duration;
  }
}

module.exports = TimeMeasurement;
