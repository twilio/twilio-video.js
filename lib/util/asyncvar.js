'use strict';

const { defer } = require('./');

/**
 * An {@link AsyncVar} is an "asynchronous variable" which may or may not
 * contain a value of some type T. You can put a value into the {@link AsyncVar}
 * with {@link AsyncVar#put}. Callers can take a value out of the
 * {@link AsyncVar} by queueing up with {@link AsyncVar#take}. N calls to
 * {@link AsyncVar#take} require N calls to {@link AsyncVar#put} to resolve, and
 * they resolve in order.
 */
class AsyncVar {
  /**
   * Construct an {@link AsyncVar}.
   */
  constructor() {
    Object.defineProperties(this, {
      _deferreds: {
        value: []
      },
      _hasValue: {
        value: false,
        writable: true
      },
      _value: {
        value: null,
        writable: true
      }
    });
  }

  /**
   * Put a value into the {@link AsyncVar}.
   * @param {T} value
   * @returns {this}
   */
  put(value) {
    this._hasValue = true;
    this._value = value;
    const deferred = this._deferreds.shift();
    if (deferred) {
      deferred.resolve(value);
    }
    return this;
  }

  /**
   * Take the value out of the {@link AsyncVar}.
   * @returns {Promise<T>}
   */
  take() {
    if (this._hasValue && !this._deferreds.length) {
      this._hasValue = false;
      return Promise.resolve(this._value);
    }
    const deferred = defer();
    this._deferreds.push(deferred);
    return deferred.promise.then(value => {
      this._hasValue = false;
      return value;
    });
  }
}

module.exports = AsyncVar;
