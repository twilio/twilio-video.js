
/**
 * Expose `Backoff`.
 */

class Backoff {
  /**
   * Construct a {@link Backoff}.
   * @param {function} fn - Function to call
   * @param {number} min - Initial timeout in milliseconds [100]
   * @param {number} max - Max timeout [10000]
   * @param {boolean} jitter - Apply jitter [0]
   * @param {number} factor - Multiplication factor for Backoff operation [2]
   */
  constructor(fn, min, max, jitter, factor) {
    Object.defineProperties(this, {
      min: {
        value: min || 100
      },
      max: {
        value: max || 10000
      },
      jitter: {
        value: jitter > 0 && jitter <= 1 ? jitter : 0
      },
      factor: {
        value: factor || 2
      },
      _fn: {
        value: fn
      },
      _attempts: {
        value: 0,
        writable: true
      },
      _duration: {
        value: 0,
        writable: true
      },
      _timeoutID: {
        value: null,
        writable: true
      },
    });
  }
  /**
  * Set the backoff duration.
  *
  * @return {Number}
  * @api private
  */
  duration() {
    let ms = this.min * Math.pow(this.factor, this._attempts++);
    if (this.jitter) {
      const rand =  Math.random();
      const deviation = Math.floor(rand * this.jitter * ms);
      ms = (Math.floor(rand * 10) & 1) === 0  ? ms - deviation : ms + deviation;
    }
    this._duration = Math.min(ms, this.max) | 0;
    return this._duration;
  }

  /**
  * Start the backoff operation.
  *
  * @return {void}
  * @api public
  */
  start() {
    this._timeoutID = setTimeout(this._fn, this.duration());
  }

  /**
  * Reset the number of attempts and clear the timer.
  *
  * @return {void}
  * @api public
  */
  reset() {
    this._attempts = 0;
    clearTimeout(this._timeoutID);
    this._timeoutID = null;
  }
}

module.exports = Backoff;
