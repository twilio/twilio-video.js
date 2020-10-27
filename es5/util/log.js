/* eslint new-cap:0, no-console:0 */
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var constants = require('./constants');
var DEFAULT_LOG_LEVEL = constants.DEFAULT_LOG_LEVEL;
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
 * Selectively outputs messages to console.log based on specified minimum module
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
   */
  function Log(moduleName, component, logLevels) {
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


  _createClass(Log, [{
    key: 'createLog',


    /**
     * Create a child {@link Log} instance with this._logLevels
     * @param moduleName - Name of the logging module
     * @param component - Component owning this instance of {@link Log}
     * @returns {Log} this
     */
    value: function createLog(moduleName, component) {
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

  }, {
    key: 'setLevels',
    value: function setLevels(levels) {
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

  }, {
    key: 'log',
    value: function log(logLevel, message) {
      var logSpec = Log._levels[logLevel];
      // eslint-disable-next-line no-use-before-define
      if (!logSpec) {
        throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES);
      }

      if (this.logLevel <= logLevel) {
        var levelName = logSpec.name;
        var prefix = new Date().toISOString().split('T').concat(['|', levelName, 'in', this.name + ':']);
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
     * Log an info message using console.info
     * @param {...String} messages - Message(s) to pass to console.info
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'info',
    value: function info() {
      return this.log(Log.INFO, [].slice.call(arguments));
    }

    /**
     * Log a warn message using console.warn
     * @param {...String} messages - Message(s) to pass to console.warn
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
     * Log an error message using console.error
     * @param {...String} messages - Message(s) to pass to console.error
     * @returns {Log} This instance of {@link Log}
     * @public
     */

  }, {
    key: 'error',
    value: function error() {
      return this.log(Log.ERROR, [].slice.call(arguments));
    }

    /**
     * Log an error message using console.error and throw an exception
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
    value: [{ name: 'DEBUG', logFn: console.log }, { name: 'INFO', logFn: console.info }, { name: 'WARN', logFn: console.warn }, { name: 'ERROR', logFn: console.error }, { name: 'OFF', logFn: function noop() {} }]
  }
});

var LOG_LEVELS_SET = {};
var LOG_LEVEL_VALUES = [];

var LOG_LEVEL_NAMES = Log._levels.map(function (level, i) {
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
  Object.keys(levels).forEach(function (moduleName) {
    validateLogLevel(levels[moduleName].toUpperCase());
  });
}

module.exports = Log;