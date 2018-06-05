'use strict';

/**
 * A {@link Timeout} represents a resettable and clearable timeout.
 */
class Timeout {
  /**
   * Construct a {@link Timeout}.
   * @param {function} fn - Function to call
   * @param {number} delay - Delay in milliseconds
   */
  constructor(fn, delay) {
    Object.defineProperties(this, {
      _delay: {
        value: delay
      },
      _fn: {
        value: fn
      },
      _timeout: {
        value: null,
        writable: true
      }
    });

    this._start();
  }

  /**
   * Start the {@link Timeout}.
   * @private
   */
  _start() {
    this._timeout = setTimeout(this._fn, this._delay);
  }

  /**
   * Whether the {@link Timeout} is set.
   * @property {boolean}
   */
  get isSet() {
    return !!this._timeout;
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
    clearTimeout(this._timeout);
    this._start();
  }
}

module.exports = Timeout;
