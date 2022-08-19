/* eslint new-cap:0 */
'use strict';

const { getLogger: defaultGetLogger } = require('../vendor/loglevel');
const { DEFAULT_LOGGER_NAME, typeErrors: E } = require('./constants');

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
 * Selectively outputs messages to console based on the specified log level.
 */
class Log {
  /**
   * Construct a new {@link Log} object.
   * @param {object} component - Component owning this instance of {@link Log}
   * @param {String} [loggerName] - Name of the logger instance. Used when calling getLogger from loglevel module
   * @param {Function} [getLogger] - optional method used internally.
   */
  constructor(component, loggerName = DEFAULT_LOGGER_NAME, getLogger = defaultGetLogger) {
    if (!component) {
      throw E.REQUIRED_ARGUMENT('component');
    }

    /* istanbul ignore next */
    Object.defineProperties(this, {
      _component: {
        value: component
      },
      _warnings: {
        value: new Set()
      },
      _loggerName: {
        value: loggerName
      },
      _logger: {
        value: getLogger(loggerName)
      },
      name: {
        get: function get() {
          return component.toString();
        }
      }
    });
  }

  /**
   * Create a child {@link Log} instance with the given log level.
   * @param component - Component owning this instance of {@link Log}
   * @returns {Log} this
   */
  createLog(component) {
    return new Log(component, this._loggerName);
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
    if (!name) {
      // eslint-disable-next-line no-use-before-define
      throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES);
    }
    name = name.toLowerCase();
    const prefix = [new Date().toISOString(), name, this.name];
    (this._logger[name] || function noop() {})(...prefix.concat(messages));
    return this;
  }

  /**
   * Log a trace message
   * @param {...String} messages - Message(s) to pass to the logger
   * @returns {Log} This instance of {@link Log}
   * @public
   */
  trace() {
    return this.log(Log.TRACE, [].slice.call(arguments));
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
  TRACE: { value: 0 },
  DEBUG: { value: 1 },
  INFO:  { value: 2 },
  WARN:  { value: 3 },
  ERROR: { value: 4 },
  OFF:   { value: 5 },
  _levels: {
    value: [
      'TRACE',
      'DEBUG',
      'INFO',
      'WARN',
      'ERROR',
      'OFF',
    ]
  }
});

const LOG_LEVEL_VALUES = Log._levels.map((level, i) => i);

module.exports = Log;
