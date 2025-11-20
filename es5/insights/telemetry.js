'use strict';
var NetworkEvents = require('./events/network');
var GetUserMediaEvents = require('./events/getusermedia');
var QualityEvents = require('./events/quality');
var TrackEvents = require('./events/track');
var ApplicationEvents = require('./events/application');
var SystemEvents = require('./events/system');
var PeerConnectionEvents = require('./events/peerconnection');
/**
 * @typedef {Object} InsightsPublisher
 * @property {(group: string, name: string, payload: Record<string, any>) => void} publish
 */
/**
 * @typedef {Object} TelemetryEventOptions
 * @property {string} group - Event group
 * @property {string} name - Event name
 * @property {Record<string, any>} [payload] - Optional event payload
 */
/**
 * @typedef {Object} TelemetryConfig
 * @property {InsightsPublisher} publisher - The insights publisher to register
 * @property {import('../util/log')} log - Logger instance
 * @property {number} connectTimestamp - Connection timestamp
 */
/**
 * Telemetry is a singleton for emitting telemetry events throughout the SDK.
 * It decouples event emission from publisher management, allowing different parts of the SDK
 * to emit events without direct coupling.
 * @internal
 */
var Telemetry = /** @class */ (function () {
    function Telemetry() {
        /** @type {InsightsPublisher | null} */
        this._publisher = null;
        /** @type {number | null} */
        this._connectTimestamp = null;
        /** @type {import('../util/log') | null} */
        this._log = null;
        /** @type {NetworkEvents} */
        this.network = new NetworkEvents(this);
        /** @type {GetUserMediaEvents} */
        this.getUserMedia = new GetUserMediaEvents(this);
        /** @type {QualityEvents} */
        this.quality = new QualityEvents(this);
        /** @type {TrackEvents} */
        this.track = new TrackEvents(this);
        /** @type {ApplicationEvents} */
        this.application = new ApplicationEvents(this);
        /** @type {SystemEvents} */
        this.system = new SystemEvents(this);
        /** @type {PeerConnectionEvents} */
        this.pc = new PeerConnectionEvents(this);
    }
    /**
     * Configure telemetry with a publisher.
     * Only one publisher can be active at a time. Calling configure again
     * will automatically reset the previous configuration.
     *
     * @param {TelemetryConfig} config - Configuration options
     * @returns {Telemetry}
     */
    Telemetry.prototype.configure = function (_a) {
        var publisher = _a.publisher, log = _a.log, connectTimestamp = _a.connectTimestamp;
        if (!publisher || !log || typeof connectTimestamp !== 'number') {
            throw new Error('Telemetry.configure requires publisher, log, and connectTimestamp');
        }
        if (this._publisher) {
            this.reset();
        }
        this._publisher = publisher;
        this._log = log;
        this._connectTimestamp = connectTimestamp;
        return this;
    };
    /**
     * Reset telemetry configuration and stop publishing events.
     * @returns {Telemetry}
     */
    Telemetry.prototype.reset = function () {
        this._publisher = null;
        this._connectTimestamp = null;
        this._log = null;
        return this;
    };
    Object.defineProperty(Telemetry.prototype, "isEnabled", {
        /**
         * Check if a publisher is currently registered.
         * @returns {boolean} True if a publisher is registered
         */
        get: function () {
            return this._publisher !== null;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Internal method to emit a telemetry event. If no publisher is registered, the event is ignored.
     * Used by the public info/warning/error methods.
     * @private
     * @param {string} group - Event group (e.g., 'get-user-media', 'quality', 'network')
     * @param {string} name - Event name (e.g., 'succeeded', 'failed')
     * @param {('info'|'warning'|'error'|'debug')} level - Event level
     * @param {Record<string, any>} [payload] - Optional event payload
     * @returns {void}
     */
    Telemetry.prototype._emit = function (group, name, level, payload) {
        if (!this._publisher || !this._log || this._connectTimestamp === null) {
            return;
        }
        var timestamp = Date.now();
        var elapsedTime = timestamp - this._connectTimestamp;
        var publisherPayload = Object.assign({ elapsedTime: elapsedTime, level: level }, payload || {});
        this._publisher.publish(group, name, publisherPayload);
        var event = Object.assign({
            elapsedTime: elapsedTime,
            group: group,
            level: level,
            name: name,
            timestamp: timestamp
        }, payload ? { payload: payload } : {});
        /** @type {'debug' | 'error' | 'info' | 'warn'} */
        var logLevel = /** @type {const} */ ({
            debug: 'debug',
            error: 'error',
            info: 'info',
            warning: 'warn'
        })[level];
        this._log[logLevel]('telemetry', event);
    };
    /**
     * Emit an info-level telemetry event.
     *
     * @param {TelemetryEventOptions} options - Event options
     * @returns {void}
     */
    Telemetry.prototype.info = function (_a) {
        var group = _a.group, name = _a.name, payload = _a.payload;
        return this._emit(group, name, 'info', payload);
    };
    /**
     * Emit a warning-level telemetry event.
     *
     * @param {TelemetryEventOptions} options - Event options
     * @returns {void}
     */
    Telemetry.prototype.warning = function (_a) {
        var group = _a.group, name = _a.name, payload = _a.payload;
        return this._emit(group, name, 'warning', payload);
    };
    /**
     * Emit an error-level telemetry event.
     *
     * @param {TelemetryEventOptions} options - Event options
     * @returns {void}
     */
    Telemetry.prototype.error = function (_a) {
        var group = _a.group, name = _a.name, payload = _a.payload;
        return this._emit(group, name, 'error', payload);
    };
    /**
     * Emit a debug-level telemetry event.
     *
     * @param {TelemetryEventOptions} options - Event options
     * @returns {void}
     */
    Telemetry.prototype.debug = function (_a) {
        var group = _a.group, name = _a.name, payload = _a.payload;
        return this._emit(group, name, 'debug', payload);
    };
    return Telemetry;
}());
module.exports = new Telemetry();
//# sourceMappingURL=telemetry.js.map