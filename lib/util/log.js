/* eslint new-cap:0 */
'use strict';

const defaultGetLogger = require('loglevel').getLogger;
const constants = require('./constants');
const { DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME } = constants;
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
 * Selectively outputs messages to console based on specified minimum module
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
   * @param {String} loggerName - Name of the logger instance. Used when calling getLogger from loglevel module
   */
  constructor(moduleName, component, logLevels, loggerName, getLogger) {
    if (typeof moduleName !== 'string') {
      throw E.INVALID_TYPE('moduleName', 'string');
    }

    if (!component) {
      throw E.REQUIRED_ARGUMENT('component');
    }

    if (typeof logLevels !== 'object') {
      logLevels = {};
    }

    getLogger = getLogger || defaultGetLogger;

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
      _loggerName: {
        get: function get() {
          let name = loggerName && typeof loggerName === 'string' ? loggerName : DEFAULT_LOGGER_NAME;

          if (!this._logLevelsEqual) {
            name = `${name}-${moduleName}`;
          }
          return name;
        }
      },
      _logger: {
        get: function get() {
          const logger = getLogger(this._loggerName);
          let level = this._logLevels[moduleName] || DEFAULT_LOG_LEVEL;

          // There is no 'off' in the logger module. It uses 'silent' instead
          level = level === 'off' ? 'silent' : level;

          logger.setDefaultLevel(level);
          return logger;
        }
      },
      _logLevelsEqual: {
        get: function get() {
          // True if all levels are the same
          return (new Set(Object.values(this._logLevels)).size) === 1;
        }
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
    let name = this._loggerName;
    // Grab the original logger name
    if (!this._logLevelsEqual) {
      name = name.substring(0, name.lastIndexOf('-'));
    }
    return new Log(moduleName, component, this._logLevels, name);
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
   * Log a message using the logger method appropriate for the specified logLevel
   * @param {Number} logLevel - Log level of the message being logged
   * @param {Array} messages - Message(s) to log
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  log(logLevel, messages) {
    let name = Log._levels[logLevel];
    // eslint-disable-next-line no-use-before-define
    if (!name) { throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES); }

    name = name.toLowerCase();
    const prefix = [new Date().toISOString(), name, this.name];

    (this._logger[name] || function noop() {})(...prefix.concat(messages));

    return this;
  }

  /**
   * Log a debug message
   * @param {...String} messages - Message(s) to pass to the logger
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
   * Log an info message
   * @param {...String} messages - Message(s) to pass to the logger
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  info() {
    return this.log(Log.INFO, [].slice.call(arguments));
  }

  /**
   * Log a warn message
   * @param {...String} messages - Message(s) to pass to the logger
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
   * Log an error message
   * @param {...String} messages - Message(s) to pass to the logger
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  error() {
    return this.log(Log.ERROR, [].slice.call(arguments));
  }

  /**
   * Log an error message and throw an exception
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
      'DEBUG',
      'INFO',
      'WARN',
      'ERROR',
      'OFF',
    ]
  }
});

const LOG_LEVELS_SET = {};
const LOG_LEVEL_VALUES = [];

const LOG_LEVEL_NAMES = Log._levels.map((level, i) => {
  LOG_LEVELS_SET[level] = true;
  LOG_LEVEL_VALUES.push(i);
  return level;
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
