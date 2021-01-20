/* eslint new-cap:0 */
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultGetLogger = require('loglevel').getLogger;
var constants = require('./constants');
var DEFAULT_LOG_LEVEL = constants.DEFAULT_LOG_LEVEL,
    DEFAULT_LOGGER_NAME = constants.DEFAULT_LOGGER_NAME;

var E = require('./constants').typeErrors;

var deprecationWarningsByComponentConstructor = void 0;

function getDeprecationWarnings(componentConstructor) {
  deprecationWarningsByComponentConstructor = deprecationWarningsByComponentConstructor || new Map();
  if (deprecationWarningsByComponentConstructor.has(componentConstructor)) {
    return deprecationWarningsByComponentConstructor.get(componentConstructor);
  }
  var deprecationWarnings = new Set();
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

var Log = function () {
  /**
   * Construct a new {@link Log} object.
   * @param {String} moduleName - Name of the logging module (webrtc/media/signaling)
   * @param {object} component - Component owning this instance of {@link Log}
   * @param {LogLevels} logLevels - Logging levels. See {@link LogLevels}
   * @param {String} loggerName - Name of the logger instance. Used when calling getLogger from loglevel module
   */
  function Log(moduleName, component, logLevels, loggerName, getLogger) {
    _classCallCheck(this, Log);

    if (typeof moduleName !== 'string') {
      throw E.INVALID_TYPE('moduleName', 'string');
    }

    if (!component) {
      throw E.REQUIRED_ARGUMENT('component');
    }

    if ((typeof logLevels === 'undefined' ? 'undefined' : _typeof(logLevels)) !== 'object') {
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
          var name = loggerName && typeof loggerName === 'string' ? loggerName : DEFAULT_LOGGER_NAME;

          if (!this._logLevelsEqual) {
            name = name + '-' + moduleName;
          }
          return name;
        }
      },
      _logger: {
        get: function get() {
          var logger = getLogger(this._loggerName);
          var level = this._logLevels[moduleName] || DEFAULT_LOG_LEVEL;

          // There is no 'off' in the logger module. It uses 'silent' instead
          level = level === 'off' ? 'silent' : level;

          logger.setDefaultLevel(level);
          return logger;
        }
      },
      _logLevelsEqual: {
        get: function get() {
          // True if all levels are the same
          return new Set(Object.values(this._logLevels)).size === 1;
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


  _createClass(Log, [{
    key: 'createLog',


    /**
     * Create a child {@link Log} instance with this._logLevels
     * @param moduleName - Name of the logging module
     * @param component - Component owning this instance of {@link Log}
     * @returns {Log} this
     */
    value: function createLog(moduleName, component) {
      var name = this._loggerName;
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

  }, {
    key: 'setLevels',
    value: function setLevels(levels) {
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

  }, {
    key: 'log',
    value: function log(logLevel, messages) {
      var name = Log._levels[logLevel];
      // eslint-disable-next-line no-use-before-define
      if (!name) {
        throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES);
      }

      name = name.toLowerCase();
      var prefix = [new Date().toISOString(), name, this.name];

      (this._logger[name] || function noop() {}).apply(undefined, _toConsumableArray(prefix.concat(messages)));

      return this;
    }

    /**
     * Log a debug message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'debug',
    value: function debug() {
      return this.log(Log.DEBUG, [].slice.call(arguments));
    }

    /**
     * Log a deprecation warning. Deprecation warnings are logged as warnings and
     * they are only ever logged once.
     * @param {String} deprecationWarning - The deprecation warning
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'deprecated',
    value: function deprecated(deprecationWarning) {
      var deprecationWarnings = getDeprecationWarnings(this._component.constructor);
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

  }, {
    key: 'info',
    value: function info() {
      return this.log(Log.INFO, [].slice.call(arguments));
    }

    /**
     * Log a warn message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'warn',
    value: function warn() {
      return this.log(Log.WARN, [].slice.call(arguments));
    }

    /**
     * Log a warning once.
     * @param {String} warning
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'warnOnce',
    value: function warnOnce(warning) {
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

  }, {
    key: 'error',
    value: function error() {
      return this.log(Log.ERROR, [].slice.call(arguments));
    }

    /**
     * Log an error message and throw an exception
     * @param {TwilioError} error - Error to throw
     * @param {String} customMessage - Custom message for the error
     * @public
     */

  }, {
    key: 'throw',
    value: function _throw(error, customMessage) {
      if (error.clone) {
        error = error.clone(customMessage);
      }

      this.log(Log.ERROR, error);
      throw error;
    }
  }], [{
    key: 'getLevelByName',
    value: function getLevelByName(name) {
      if (!isNaN(name)) {
        return parseInt(name, 10);
      }
      name = name.toUpperCase();
      validateLogLevel(name);
      return Log[name];
    }
  }]);

  return Log;
}();

// Singleton Constants
/* eslint key-spacing:0 */
/* istanbul ignore next */


Object.defineProperties(Log, {
  DEBUG: { value: 0 },
  INFO: { value: 1 },
  WARN: { value: 2 },
  ERROR: { value: 3 },
  OFF: { value: 4 },
  _levels: {
    value: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF']
  }
});

var LOG_LEVELS_SET = {};
var LOG_LEVEL_VALUES = [];

var LOG_LEVEL_NAMES = Log._levels.map(function (level, i) {
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
  Object.keys(levels).forEach(function (moduleName) {
    validateLogLevel(levels[moduleName].toUpperCase());
  });
}

module.exports = Log;