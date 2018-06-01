'use strict';

/**
 * A {@link Timeout} represents a resettable and clearable timeout.
 */
class Timeout {
  /**
   * Construct a {@link Timeout}.
   * @param {function} fn - Function to call
   * @param {number} delay - Delay in milliseconds
   * @param {Array<*>} args - Optional arguments to be passed to the function
   */
  constructor(fn, delay, ...args) {
    Object.defineProperties(this, {
      _args: {
        value: args
      },
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
    this._timeout = setTimeout(this._fn, this._delay, ...this._args);
  }

  /**
   * Clear the {@link Timeout}.
   */
  clear() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }

  /**
   * Reset the {@link Timeout}.
   */
  reset() {
    clearTimeout(this._timeout);
    this._start();
  }
}

module.exports = Timeout;
