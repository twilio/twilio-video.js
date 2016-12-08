'use strict';

var inherits = require('util').inherits;

/**
 * Creates a new {@link TwilioError}
 * @extends Error
 * @param {number} code - Error code
 * @param {string} [message] - Error message
 * @param {string} [fileName] - Name of the script file where error was generated
 * @param {number} [lineNumber] - Line number of the script file where error was generated
 * @property {number} code - Error code
 * @constructor
 */
function TwilioError(code) {
  var error = Error.apply(this, [].slice.call(arguments, 1));
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

inherits(TwilioError, Error);

/**
 * Returns human readable string describing the error.
 * @returns {string}
 */
TwilioError.prototype.toString = function toString() {
  var message = this.message ? ': ' + this.message : '';
  return this.name + ' ' + this.code + message;
};

module.exports = TwilioError;
