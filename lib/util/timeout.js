'use strict';

/**
 * A {@link Timeout} represents a resettable and clearable timeout.
 */
class Timeout {
  /**
   * Construct a {@link Timeout}.
   * @param {function} fn - Function to call
   * @param {number} delay - Delay in milliseconds
   * @param {boolean} [autoStart=true] - If true, then start the {@link Timeout}.
   */
  constructor(fn, delay, autoStart = true) {
    Object.defineProperties(this, {
      _delay: {
        value: delay,
        writable: true
      },
      _fn: {
        value: fn
      },
      _timeout: {
        value: null,
        writable: true
      }
    });

    if (autoStart) {
      this.start();
    }
  }

  /**
   * The {@link Timeout} delay in milliseconds.
   * @property {number}
   */
  get delay() {
    return this._delay;
  }

  /**
   * Whether the {@link Timeout} is set.
   * @property {boolean}
   */
  get isSet() {
    return !!this._timeout;
  }

  /**
   * Update the {@link Timeout} delay.
   * @param {number} delay
   * @returns {void}
   */
  setDelay(delay) {
    this._delay = delay;
  }

  /**
   * Start the {@link Timeout}, if not already started.
   * @returns {void}
   */
  start() {
    if (!this.isSet) {
      this._timeout = setTimeout(() => {
        const fn = this._fn;
        this.clear();
        fn();
      }, this._delay);
    }
  }

  /**
   * Clear the {@link Timeout}.
   * @returns {void}
   */
  clear() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }

  /**
   * Reset the {@link Timeout}.
   * @returns {void}
   */
  reset() {
    this.clear();
    this.start();
  }
}

module.exports = Timeout;
