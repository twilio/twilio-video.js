'use strict';

/**
 * @extends Error
 * @property {number} code - Error code
 */
class TwilioError extends Error {
  /**
   * Creates a new {@link TwilioError}
   * @param {number} code - Error code
   * @param {string} [message] - Error message
   * @param {string} [fileName] - Name of the script file where error was generated
   * @param {number} [lineNumber] - Line number of the script file where error was generated
   */
  constructor(code) {
    const args = [].slice.call(arguments, 1);
    super(...args);
    Object.setPrototypeOf(this, TwilioError.prototype);

    const error = Error.apply(this, args);
    error.name = 'TwilioError';

    Object.defineProperty(this, 'code', {
      value: code,
      enumerable: true
    });

    Object.getOwnPropertyNames(error).forEach(function(prop) {
      Object.defineProperty(this, prop, {
        value: error[prop],
        enumerable: true
      });
    }, this);
  }

  /**
   * Returns human readable string describing the error.
   * @returns {string}
   */
  toString() {
    const message = this.message ? `: ${this.message}` : '';
    return `${this.name} ${this.code}${message}`;
  }
}

module.exports = TwilioError;
