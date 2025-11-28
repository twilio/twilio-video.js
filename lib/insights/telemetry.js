'use strict';

const NetworkEvents = require('./events/network');
const GetUserMediaEvents = require('./events/getusermedia');
const QualityEvents = require('./events/quality');
const TrackEvents = require('./events/track');
const ApplicationEvents = require('./events/application');
const SystemEvents = require('./events/system');
const PeerConnectionEvents = require('./events/peerconnection');

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
class Telemetry {
  constructor() {
    /** @type {InsightsPublisher | null} */
    this._publisher = null;
    /** @type {number | null} */
    this._connectTimestamp = null;
    /** @type {import('../util/log') | null} */
    this._log = null;
    /** @type {boolean} */
    this._isConfigured = false;

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
   *
   * @param {TelemetryConfig} config - Configuration options
   * @returns {Telemetry}
   */
  configure({ publisher, log, connectTimestamp }) {
    if (!publisher || !log || typeof connectTimestamp !== 'number') {
      throw new Error('Telemetry.configure requires publisher, log, and connectTimestamp');
    }

    this._publisher = publisher;
    this._log = log;
    this._connectTimestamp = connectTimestamp;
    this._isConfigured = true;

    this._publisher.on('connected', () => {
      this._log.debug('Telemetry publisher connected.');
    });

    this._publisher.on('reconnecting', () => {
      this._log.warn('Telemetry publisher reconnecting...');
    });

    return this;
  }

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
  _emit(group, name, level, payload) {
    if (!this._isConfigured) {
      return;
    }

    const timestamp = Date.now();
    const elapsedTime = timestamp - this._connectTimestamp;

    const publisherPayload = Object.assign({ elapsedTime, level }, payload || {});
    const published = this._publisher.publish(group, name, publisherPayload);

    if (!published) {
      this._log.warn(`Telemetry event "${group}:${name}" dropped - publisher unavailable.`);
      return;
    }

    const event = Object.assign({
      elapsedTime,
      group,
      level,
      name,
      timestamp
    }, payload ? { payload } : {});

    /** @type {'debug' | 'error' | 'info' | 'warn'} */
    const logLevel = /** @type {const} */ ({
      debug: 'debug',
      error: 'error',
      info: 'info',
      warning: 'warn'
    })[level];
    this._log[logLevel]('telemetry', event);
  }

  /**
   * Emit an info-level telemetry event.
   *
   * @param {TelemetryEventOptions} options - Event options
   * @returns {void}
   */
  info({ group, name, payload }) {
    return this._emit(group, name, 'info', payload);
  }

  /**
   * Emit a warning-level telemetry event.
   *
   * @param {TelemetryEventOptions} options - Event options
   * @returns {void}
   */
  warning({ group, name, payload }) {
    return this._emit(group, name, 'warning', payload);
  }

  /**
   * Emit an error-level telemetry event.
   *
   * @param {TelemetryEventOptions} options - Event options
   * @returns {void}
   */
  error({ group, name, payload }) {
    return this._emit(group, name, 'error', payload);
  }

  /**
   * Emit a debug-level telemetry event.
   *
   * @param {TelemetryEventOptions} options - Event options
   * @returns {void}
   */
  debug({ group, name, payload }) {
    return this._emit(group, name, 'debug', payload);
  }
}

module.exports = new Telemetry();
