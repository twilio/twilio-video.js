/* eslint new-cap:0, no-console:0 */
'use strict';

const constants = require('./constants');
const DEFAULT_LOG_LEVEL = constants.DEFAULT_LOG_LEVEL;
const E = require('./constants').typeErrors;

let deprecationWarningsByComponentConstructor;

function getDeprecationWarnings(componentConstructor) {
  deprecationWarningsByComponentConstructor = deprecationWarningsByComponentConstructor || new Map();
  if (deprecationWarningsByComponentConstructor.has(componentConstructor)) {
    return deprecationWarningsByComponentConstructor.get(componentConstructor);
  }
  const deprecationWarnings = new Set();
  deprecationWarningsByComponentConstructor.set(componentConstructor, deprecationWarnings);
  return deprecationWarnings;
}

/**
 * Selectively outputs messages to console.log based on specified minimum module
 * specific log levels.
 *
 * NOTE: The values in the logLevels object passed to the constructor is changed
 *       by subsequent calls to {@link Log#setLevels}.
 */
class Log {
  /**
   * Construct a new {@link Log} object.
   * @param {String} moduleName - Name of the logging module (webrtc/media/signaling)
   * @param {object} component - Component owning this instance of {@link Log}
   * @param {LogLevels} logLevels - Logging levels. See {@link LogLevels}
   */
  constructor(moduleName, component, logLevels) {
    if (typeof moduleName !== 'string') {
      throw E.INVALID_TYPE('moduleName', 'string');
    }

    if (!component) {
      throw E.REQUIRED_ARGUMENT('component');
    }

    if (typeof logLevels !== 'object') {
      logLevels = {};
    }

    validateLogLevels(logLevels);

    /* istanbul ignore next */
    Object.defineProperties(this, {
      _component: {
        value: component
      },
      _logLevels: {
        value: logLevels
      },
      _warnings: {
        value: new Set()
      },
      logLevel: {
        get: function get() {
          return Log.getLevelByName(logLevels[moduleName] || DEFAULT_LOG_LEVEL);
        }
      },
      name: { get: component.toString.bind(component) }
    });
  }

  /**
   * Get the log level (number) by its name (string)
   * @param {String} name - Name of the log level
   * @returns {Number} Requested log level
   * @throws {TwilioError} INVALID_LOG_LEVEL (32056)
   * @public
   */
  static getLevelByName(name) {
    if (!isNaN(name)) {
      return parseInt(name, 10);
    }
    name = name.toUpperCase();
    validateLogLevel(name);
    return Log[name];
  }

  /**
   * Create a child {@link Log} instance with this._logLevels
   * @param moduleName - Name of the logging module
   * @param component - Component owning this instance of {@link Log}
   * @returns {Log} this
   */
  createLog(moduleName, component) {
    return new Log(moduleName, component, this._logLevels);
  }

  /**
   * Set new log levels.
   * This changes the levels for all its ancestors,
   * siblings, and children and descendants instances of {@link Log}.
   * @param {LogLevels} levels - New log levels
   * @throws {TwilioError} INVALID_ARGUMENT
   * @returns {Log} this
   */
  setLevels(levels) {
    validateLogLevels(levels);
    Object.assign(this._logLevels, levels);
    return this;
  }

  /**
   * Log a message using the console method appropriate for the specified logLevel
   * @param {Number} logLevel - Log level of the message being logged
   * @param {String} message - Message(s) to log
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  log(logLevel, message) {
    const logSpec = Log._levels[logLevel];
    // eslint-disable-next-line no-use-before-define
    if (!logSpec) { throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES); }

    if (this.logLevel <= logLevel) {
      const levelName = logSpec.name;
      const prefix = new Date().toISOString().split('T').concat([
        '|', levelName, 'in', `${this.name}:`
      ]);
      logSpec.logFn.apply(console, prefix.concat(message));
    }

    return this;
  }

  /**
   * Log a debug message using console.log
   * @param {...String} messages - Message(s) to pass to console.log
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  debug() {
    return this.log(Log.DEBUG, [].slice.call(arguments));
  }

  /**
   * Log a deprecation warning. Deprecation warnings are logged as warnings and
   * they are only ever logged once.
   * @param {String} deprecationWarning - The deprecation warning
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  deprecated(deprecationWarning) {
    const deprecationWarnings = getDeprecationWarnings(this._component.constructor);
    if (deprecationWarnings.has(deprecationWarning)) {
      return this;
    }
    deprecationWarnings.add(deprecationWarning);
    return this.warn(deprecationWarning);
  }

  /**
   * Log an info message using console.info
   * @param {...String} messages - Message(s) to pass to console.info
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  info() {
    return this.log(Log.INFO, [].slice.call(arguments));
  }

  /**
   * Log a warn message using console.warn
   * @param {...String} messages - Message(s) to pass to console.warn
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  warn() {
    return this.log(Log.WARN, [].slice.call(arguments));
  }

  /**
   * Log a warning once.
   * @param {String} warning
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  warnOnce(warning) {
    if (this._warnings.has(warning)) {
      return this;
    }
    this._warnings.add(warning);
    return this.warn(warning);
  }

  /**
   * Log an error message using console.error
   * @param {...String} messages - Message(s) to pass to console.error
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  error() {
    return this.log(Log.ERROR, [].slice.call(arguments));
  }

  /**
   * Log an error message using console.error and throw an exception
   * @param {TwilioError} error - Error to throw
   * @param {String} customMessage - Custom message for the error
   * @public
   */
  throw(error, customMessage) {
    if (error.clone) {
      error = error.clone(customMessage);
    }

    this.log(Log.ERROR, error);
    throw error;
  }
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

const LOG_LEVELS_SET = {};
const LOG_LEVEL_VALUES = [];

const LOG_LEVEL_NAMES = Log._levels.map((level, i) => {
  LOG_LEVELS_SET[level.name] = true;
  LOG_LEVEL_VALUES.push(i);
  return level.name;
});

function validateLogLevel(level) {
  if (!(level in LOG_LEVELS_SET)) {
    throw E.INVALID_VALUE('level', LOG_LEVEL_NAMES);
  }
}

function validateLogLevels(levels) {
  Object.keys(levels).forEach(moduleName => {
    validateLogLevel(levels[moduleName].toUpperCase());
  });
}

module.exports = Log;
