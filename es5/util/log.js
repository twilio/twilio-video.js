/* eslint new-cap:0 */
'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var defaultGetLogger = require('../vendor/loglevel').getLogger;
var _a = require('./constants'), DEFAULT_LOGGER_NAME = _a.DEFAULT_LOGGER_NAME, E = _a.typeErrors;
var deprecationWarningsByComponentConstructor;
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
 * Selectively outputs messages to console based on the specified log level.
 */
var Log = /** @class */ (function () {
    /**
     * Construct a new {@link Log} object.
     * @param {object} component - Component owning this instance of {@link Log}
     * @param {String} [loggerName] - Name of the logger instance. Used when calling getLogger from loglevel module
     * @param {Function} [getLogger] - optional method used internally.
     */
    function Log(component, loggerName, getLogger) {
        if (loggerName === void 0) { loggerName = DEFAULT_LOGGER_NAME; }
        if (getLogger === void 0) { getLogger = defaultGetLogger; }
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
    Log.prototype.createLog = function (component) {
        return new Log(component, this._loggerName);
    };
    /**
     * Log a message using the logger method appropriate for the specified logLevel
     * @param {Number} logLevel - Log level of the message being logged
     * @param {Array} messages - Message(s) to log
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.log = function (logLevel, messages) {
        var name = Log._levels[logLevel];
        if (!name) {
            // eslint-disable-next-line no-use-before-define
            throw E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES);
        }
        name = name.toLowerCase();
        var prefix = [new Date().toISOString(), name, this.name];
        (this._logger[name] || function noop() { }).apply(void 0, __spreadArray([], __read(prefix.concat(messages))));
        return this;
    };
    /**
     * Log a trace message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.trace = function () {
        return this.log(Log.TRACE, [].slice.call(arguments));
    };
    /**
     * Log a debug message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.debug = function () {
        return this.log(Log.DEBUG, [].slice.call(arguments));
    };
    /**
     * Log a deprecation warning. Deprecation warnings are logged as warnings and
     * they are only ever logged once.
     * @param {String} deprecationWarning - The deprecation warning
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.deprecated = function (deprecationWarning) {
        var deprecationWarnings = getDeprecationWarnings(this._component.constructor);
        if (deprecationWarnings.has(deprecationWarning)) {
            return this;
        }
        deprecationWarnings.add(deprecationWarning);
        return this.warn(deprecationWarning);
    };
    /**
     * Log an info message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.info = function () {
        return this.log(Log.INFO, [].slice.call(arguments));
    };
    /**
     * Log a warn message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.warn = function () {
        return this.log(Log.WARN, [].slice.call(arguments));
    };
    /**
     * Log a warning once.
     * @param {String} warning
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.warnOnce = function (warning) {
        if (this._warnings.has(warning)) {
            return this;
        }
        this._warnings.add(warning);
        return this.warn(warning);
    };
    /**
     * Log an error message
     * @param {...String} messages - Message(s) to pass to the logger
     * @returns {Log} This instance of {@link Log}
     * @public
     */
    Log.prototype.error = function () {
        return this.log(Log.ERROR, [].slice.call(arguments));
    };
    /**
     * Log an error message and throw an exception
     * @param {TwilioError} error - Error to throw
     * @param {String} customMessage - Custom message for the error
     * @public
     */
    Log.prototype.throw = function (error, customMessage) {
        if (error.clone) {
            error = error.clone(customMessage);
        }
        this.log(Log.ERROR, error);
        throw error;
    };
    return Log;
}());
// Singleton Constants
/* eslint key-spacing:0 */
/* istanbul ignore next */
Object.defineProperties(Log, {
    TRACE: { value: 0 },
    DEBUG: { value: 1 },
    INFO: { value: 2 },
    WARN: { value: 3 },
    ERROR: { value: 4 },
    OFF: { value: 5 },
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
var LOG_LEVEL_VALUES = Log._levels.map(function (level, i) { return i; });
module.exports = Log;
//# sourceMappingURL=log.js.map