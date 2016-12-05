/* eslint no-console:0 */
'use strict';

// Dependencies
var constants = require('./constants');
var DEFAULT_LOG_LEVEL = constants.DEFAULT_LOG_LEVEL;
var E = require('./constants').typeErrors;

/**
 * Construct a new {@link Log} object.
 * @class
 * @classdesc Selectively outputs messages to console.log
 *   based on specified minimum module specific log levels.
 *
 * NOTE: The values in the logLevels object passed to the constructor is changed
 *       by subsequent calls to {@link Log#setLevels}.
 *
 * @param {String} moduleName - Name of the logging module (webrtc/media/signaling)
 * @param {object} component - Component owning this instance of {@link Log}
 * @param {LogLevels} logLevels - Logging levels. See {@link LogLevels}
 */
function Log(moduleName, component, logLevels) {
  if (!(this instanceof Log)) {
    return new Log(moduleName, component, logLevels);
  }

  if (typeof moduleName !== 'string') {
    throw new E.INVALID_TYPE('moduleName', 'string');
  }

  if (!component) {
    throw new E.REQUIRED_ARGUMENT('component');
  }

  if (typeof logLevels !== 'object') {
    logLevels = {};
  }

  validateLogLevels(logLevels);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _logLevels: {
      value: logLevels
    },
    logLevel: {
      get: function get() {
        return Log.getLevelByName(logLevels[moduleName] || DEFAULT_LOG_LEVEL);
      }
    },
    name: { get: component.toString.bind(component) }
  });
}

// Singleton Constants
/* eslint key-spacing:0 */
/* istanbul ignore next */
Object.defineProperties(Log, {
  DEBUG: { value: 0 },
  INFO:  { value: 1 },
  WARN:  { value: 2 },
  ERROR: { value: 3 },
  OFF:   { value: 4 },
  _levels: {
    value: [
      { name: 'DEBUG', logFn: console.log },
      { name: 'INFO',  logFn: console.info },
      { name: 'WARN',  logFn: console.warn },
      { name: 'ERROR', logFn: console.error },
      { name: 'OFF', logFn: function noop() {} }
    ]
  }
});

var LOG_LEVELS_SET = {};
var LOG_LEVEL_VALUES = [];

var LOG_LEVEL_NAMES = Log._levels.map(function(level, i) {
  LOG_LEVELS_SET[level.name] = true;
  LOG_LEVEL_VALUES.push(i);
  return level.name;
});

function validateLogLevel(level) {
  if (!(level in LOG_LEVELS_SET)) {
    throw new E.INVALID_VALUE('level', LOG_LEVEL_NAMES);
  }
}

function validateLogLevels(levels) {
  Object.keys(levels).forEach(function(moduleName) {
    validateLogLevel(levels[moduleName].toUpperCase());
  });
}

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
  validateLogLevel(name);
  return Log[name];
};

/**
 * Create a child {@link Log} instance with this._logLevels
 * @param moduleName - Name of the logging module
 * @param component - Component owning this instance of {@link Log}
 * @returns {Log} this
 */
Log.prototype.createLog = function createLog(moduleName, component) {
  return new Log(moduleName, component, this._logLevels);
};

/**
 * Set new log levels.
 * This changes the levels for all its ancestors,
 * siblings, and children and descendants instances of {@link Log}.
 * @param {LogLevels} levels - New log levels
 * @throws {TwilioError} INVALID_ARGUMENT
 * @returns {Log} this
 */
Log.prototype.setLevels = function setLevels(levels) {
  validateLogLevels(levels);
  Object.assign(this._logLevels, levels);
  return this;
};

/**
 * Log a message using the console method appropriate for the specified logLevel
 * @param {Number} logLevel - Log level of the message being logged
 * @param {String} message - Message(s) to log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.log = function log(logLevel, message) {
  var logSpec = Log._levels[logLevel];
  if (!logSpec) { throw new E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES); }

  if (this.logLevel <= logLevel) {
    var levelName = logSpec.name;
    var prefix = new Date().toISOString().split('T').concat([
      '|', levelName, 'in', this.name + ':'
    ]);
    logSpec.logFn.apply(console, prefix.concat(message));
  }

  return this;
};

/**
 * Log a debug message using console.log
 * @param {...String} messages - Message(s) to pass to console.log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.debug = function debug() {
  return this.log(Log.DEBUG, [].slice.call(arguments));
};

/**
 * Log an info message using console.info
 * @param {...String} messages - Message(s) to pass to console.info
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.info = function info() {
  return this.log(Log.INFO, [].slice.call(arguments));
};

/**
 * Log a warn message using console.warn
 * @param {...String} messages - Message(s) to pass to console.warn
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.warn = function warn() {
  return this.log(Log.WARN, [].slice.call(arguments));
};

/**
 * Log an error message using console.error
 * @param {...String} messages - Message(s) to pass to console.error
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.error = function error() {
  return this.log(Log.ERROR, [].slice.call(arguments));
};

/**
 * Log an error message using console.error and throw an exception
 * @param {TwilioError} error - Error to throw
 * @param {String} customMessage - Custom message for the error
 * @public
 */
Log.prototype.throw = function throwFn(error, customMessage) {
  if (error.clone) {
    error = error.clone(customMessage);
  }

  this.log(Log.ERROR, error);
  throw error;
};

module.exports = Log;
