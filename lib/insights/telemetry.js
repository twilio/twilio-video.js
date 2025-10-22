'use strict';

const EventEmitter = require('events');

/**
 * Telemetry is a singleton for emitting telemetry events throughout the SDK.
 * It decouples event emission from publisher management, allowing different parts of the SDK
 * to emit events without direct coupling.
 *
 * @example
 * const telemetry = require('./insights/telemetry');
 *
 * telemetry.registerPublisher(publisher, connectTimestamp, log);
 *
 * // Emit events using convenience methods
 * telemetry.info({ group: 'get-user-media', name: 'succeeded' });
 * telemetry.warning({ group: 'quality', name: 'degraded', payload: { reason: 'cpu' } });
 * telemetry.error({ group: 'connection', name: 'failed', payload: { error: 'timeout' } });
 *
 * // Later - cleanup
 * telemetry.unregisterPublisher();
 *
 * @extends EventEmitter
 */
class Telemetry extends EventEmitter {
  constructor() {
    super();
    this._publisher = null;
    this._connectTimestamp = null;
    this._log = null;
  }

  /**
   * Register a publisher for telemetry events.
   * Only one publisher can be active at a time. Registering a new publisher
   * will automatically unregister the previous one.
   *
   * @param {InsightsPublisher} publisher - The insights publisher to register
   * @param {number} connectTimestamp - The timestamp when the connection was initiated
   * @param {Log} log - Logger instance
   */
  registerPublisher(publisher, connectTimestamp, log) {
    if (this._publisher) {
      this.unregisterPublisher();
    }

    this._publisher = publisher;
    this._connectTimestamp = connectTimestamp;
    this._log = log;
  }

  /**
   * Unregister the current publisher and stop publishing events.
   */
  unregisterPublisher() {
    this._publisher = null;
    this._connectTimestamp = null;
    this._log = null;
  }

  /**
   * Check if a publisher is currently registered.
   * @returns {boolean} True if a publisher is registered
   */
  get isEnabled() {
    return this._publisher !== null;
  }

  /**
   * Internal method to emit a telemetry event. If no publisher is registered, the event is ignored.
   * @private
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} options.name - Event name (e.g., 'succeeded', 'failed')
   * @param {string} options.level - Event level ('info', 'warning', 'error') - required
   * @param {Object} [options.payload] - Optional event payload
   */
  _emit({ group, name, level, payload }) {
    if (!this._publisher) {
      return;
    }

    const timestamp = Date.now();
    const elapsedTime = timestamp - this._connectTimestamp;

    const publisherPayload = Object.assign({ elapsedTime, level }, payload || {});
    this._publisher.publish(group, name, publisherPayload);

    const event = Object.assign({
      elapsedTime,
      group,
      level,
      name,
      timestamp
    }, payload ? { payload } : {});

    const logLevel = {
      debug: 'debug',
      error: 'error',
      info: 'info',
      warning: 'warn'
    }[level];
    this._log[logLevel]('telemetry', event);
  }

  /**
   * Emit an info-level telemetry event.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} options.name - Event name (e.g., 'succeeded', 'failed')
   * @param {Object} [options.payload] - Optional event payload
   *
   * @example
   * telemetry.info({ group: 'get-user-media', name: 'succeeded' });
   * // Emits: { name: 'succeeded', group: 'get-user-media', level: 'info' }
   *
   * telemetry.info({ group: 'network', name: 'changed', payload: { type: 'wifi' } });
   * // Emits: { name: 'changed', group: 'network', level: 'info', payload: { type: 'wifi' } }
   */
  info({ group, name, payload }) {
    return this._emit({ group, name, level: 'info', payload });
  }

  /**
   * Emit a warning-level telemetry event.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'track-warning-raised', 'quality')
   * @param {string} options.name - Event name (e.g., 'track-stalled', 'degraded')
   * @param {Object} [options.payload] - Optional event payload
   *
   * @example
   * telemetry.warning({ group: 'track-warning-raised', name: 'track-stalled', payload: { trackSid: 'MT123' } });
   * // Emits: { name: 'track-stalled', group: 'track-warning-raised', level: 'warning', payload: { trackSid: 'MT123' } }
   */
  warning({ group, name, payload }) {
    return this._emit({ group, name, level: 'warning', payload });
  }

  /**
   * Emit an error-level telemetry event.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'connection', 'media')
   * @param {string} options.name - Event name (e.g., 'failed', 'error')
   * @param {Object} [options.payload] - Optional event payload
   *
   * @example
   * telemetry.error({ group: 'connection', name: 'failed', payload: { reason: 'timeout' } });
   * // Emits: { name: 'failed', group: 'connection', level: 'error', payload: { reason: 'timeout' } }
   */
  error({ group, name, payload }) {
    return this._emit({ group, name, level: 'error', payload });
  }

}

module.exports = new Telemetry();
