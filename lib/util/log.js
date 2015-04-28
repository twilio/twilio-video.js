'use strict';

// Dependencies
var util = require('./');

/**
 * Construct a new {@link Log} object.
 * @class
 * @classdesc Selectively outputs messages to console.log
 *   based on a specified minimum log level.
 * @param {String} Name of this instance of {@link Log}
 * @param {Options} [options]
 */
function Log(name, options) {
  if(!(this instanceof Log)) {
    return new Log(name, options);
  }

  options = util.withDefaults(options, { 'logLevel': Log.INFO });
  var logLevel = options['logLevel'];

  Object.defineProperties(this, {
    'name': { value: name },
    'level': { value: logLevel }
  });
}

// Constants
Log.DEBUG = 0;
Log.INFO = 1;
Log.WARN = 2;
Log.ERROR = 3;
Log._levels = [
  { name: 'DEBUG', logFn: console.log },
  { name: 'INFO',  logFn: console.info },
  { name: 'WARN',  logFn: console.warn },
  { name: 'ERROR', logFn: console.error }
];

/**
 * Log a message using the console method appropriate for the specified logLevel
 * @param {Number} Log level of the message being logged
 * @param {String} Message(s) to log
 * @returns {Log} This instance of {@link Log}
 */
Log.prototype.log = function log(logLevel, message) {
  if(this.level <= logLevel) {
    var levelName = Log._levels[logLevel].name;
    var prefix = [this.name, levelName];

    Log._levels[logLevel].logFn.apply(console, prefix.concat(message));
  }

  return this;
}

/**
 * Log a debug message using console.log
 * @param {String} Message(s) to pass to console.log
 * @returns {Log} This instance of {@link Log}
 */
Log.prototype.debug = function debug() {
  return this.log.call(this, Log.DEBUG, [].slice.call(arguments));
}
/**
 * Log an info message using console.info
 * @param {String} Message(s) to pass to console.info
 * @returns {Log} This instance of {@link Log}
 */
Log.prototype.info = function info() {
  return this.log.call(this, Log.INFO, [].slice.call(arguments));
};
/**
 * Log a warn message using console.warn
 * @param {String} Message(s) to pass to console.warn
 * @returns {Log} This instance of {@link Log}
 */
Log.prototype.warn = function warn() {
  return this.log.call(this, Log.WARN, [].slice.call(arguments));
};
/**
 * Log an error message using console.error
 * @param {String} Message(s) to pass to console.error
 * @returns {Log} This instance of {@link Log}
 */
Log.prototype.error = function error() {
  return this.log.call(this, Log.ERROR, [].slice.call(arguments));
};

module.exports = Log;
