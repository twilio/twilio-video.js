'use strict';

// Dependencies
var util = require('./');
var TwilioError = require('./twilioerror');
var E = require('./constants').twilioErrors;

/**
 * Construct a new {@link Log} object.
 * @class
 * @classdesc Selectively outputs messages to console.log
 *   based on a specified minimum log level.
 * @param {String} name - Name of this instance of {@link Log}
 * @param {Number} logLevel - Level of logging. See Log.* constants.
 */
function Log(name, logLevel) {
  if (!(this instanceof Log)) {
    return new Log(name);
  }

  var logLevel = logLevel ? Log.getLevelByName(logLevel) : Log.INFO;

  Object.defineProperties(this, {
    logLevel: { value: logLevel },
    name: { value: name }
  });
}

// Singleton Constants
Object.defineProperties(Log, {
  DEBUG: { value: 0 },
  INFO:  { value: 1 },
  WARN:  { value: 2 },
  ERROR: { value: 3 },
  OFF:   { value: 4 },
  _levels: { value: [
    { name: 'DEBUG', logFn: console.log },
    { name: 'INFO',  logFn: console.info },
    { name: 'WARN',  logFn: console.warn },
    { name: 'ERROR', logFn: console.error },
    { name: 'OFF',   logFn: function noLog() { } }
  ]}
});

/**
 * Get the log level (number) by its name (string)
 * @param {String} name - Name of the log level
 * @returns {Number} Requested log level
 * @throws {TwilioError} INVALID_LOG_LEVEL (32056)
 * @public
 */
Log.getLevelByName = function getLevelByName(name) {
  if (!isNaN(name)) {
    return parseInt(name, 10);
  }

  name = name.toUpperCase();

  if (['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'].indexOf(name) === -1) {
    var message = 'Log level must be one of: ["off", "error", "warn", "info", "debug"]';
    throw E.INVALID_ARGUMENT.clone(message);
  }

  return Log[name];
};

/**
 * Log a message using the console method appropriate for the specified logLevel
 * @param {Number} logLevel - Log level of the message being logged
 * @param {String} message - Message(s) to log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.log = function log(logLevel, message) {
  if(this.logLevel <= logLevel) {
    var levelName = Log._levels[logLevel].name;
    var prefix = [this.name, levelName];

    Log._levels[logLevel].logFn.apply(console, prefix.concat(message));
  }

  return this;
}

/**
 * Log a debug message using console.log
 * @param {...String} messages - Message(s) to pass to console.log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.debug = function debug() {
  return this.log.call(this, Log.DEBUG, [].slice.call(arguments));
}
/**
 * Log an info message using console.info
 * @param {...String} messages - Message(s) to pass to console.info
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.info = function info() {
  return this.log.call(this, Log.INFO, [].slice.call(arguments));
};
/**
 * Log a warn message using console.warn
 * @param {...String} messages - Message(s) to pass to console.warn
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.warn = function warn() {
  return this.log.call(this, Log.WARN, [].slice.call(arguments));
};
/**
 * Log an error message using console.error
 * @param {...String} messages - Message(s) to pass to console.error
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.error = function error() {
  return this.log.call(this, Log.ERROR, [].slice.call(arguments));
};
/**
 * Log an error message using console.error and throw an exception
 * @param {TwilioError} origError - Error to throw
 * @param {String} customMessage - Custom message for the error
 * @public
 */
Log.prototype.throw = function throwFn(error, customMessage) {
  if(error.clone) {
    error = error.clone(customMessage);
  }

  this.log.call(this, Log.ERROR, error);
  throw error;
};

module.exports = Log;
