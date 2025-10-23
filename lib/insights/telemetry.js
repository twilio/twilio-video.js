'use strict';

const NetworkEvents = require('./events/network');
const GetUserMediaEvents = require('./events/getusermedia');
const QualityEvents = require('./events/quality');
const TrackEvents = require('./events/track');
const ApplicationEvents = require('./events/application');
const SystemEvents = require('./events/system');

/**
 * Telemetry is a singleton for emitting telemetry events throughout the SDK.
 * It decouples event emission from publisher management, allowing different parts of the SDK
 * to emit events without direct coupling.
 * @internal
 */
class Telemetry {
  constructor() {
    this._publisher = null;
    this._connectTimestamp = null;
    this._log = null;

    this.network = new NetworkEvents(this);
    this.getUserMedia = new GetUserMediaEvents(this);
    this.quality = new QualityEvents(this);
    this.track = new TrackEvents(this);
    this.application = new ApplicationEvents(this);
    this.system = new SystemEvents(this);
  }

  /**
   * Configure telemetry with a publisher.
   * Only one publisher can be active at a time. Calling configure again
   * will automatically reset the previous configuration.
   *
   * @param {Object} config - Configuration options
   * @param {InsightsPublisher} config.publisher - The insights publisher to register
   * @param {Log} config.log - Logger instance
   * @param {number} config.connectTimestamp - Connection timestamp
   * @returns {Telemetry}
   */
  configure({ publisher, log, connectTimestamp }) {
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
  }

  /**
   * Reset telemetry configuration and stop publishing events.
   * @returns {Telemetry}
   */
  reset() {
    this._publisher = null;
    this._connectTimestamp = null;
    this._log = null;
    return this;
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
   * Used by the public info/warning/error methods.
   * @private
   * @param {string} group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} name - Event name (e.g., 'succeeded', 'failed')
   * @param {string} level - Event level ('info', 'warning', 'error')
   * @param {Object} [payload] - Optional event payload
   */
  _emit(group, name, level, payload) {
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
   * Legacy method for backward compatibility.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} options.name - Event name (e.g., 'succeeded', 'failed')
   * @param {Object} [options.payload] - Optional event payload
   *
   */
  info({ group, name, payload }) {
    return this._emit(group, name, 'info', payload);
  }

  /**
   * Emit a warning-level telemetry event.
   * Legacy method for backward compatibility.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'track-warning-raised', 'quality')
   * @param {string} options.name - Event name (e.g., 'track-stalled', 'degraded')
   * @param {Object} [options.payload] - Optional event payload
   *
   */
  warning({ group, name, payload }) {
    return this._emit(group, name, 'warning', payload);
  }

  /**
   * Emit an error-level telemetry event.
   * Legacy method for backward compatibility.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'connection', 'media')
   * @param {string} options.name - Event name (e.g., 'failed', 'error')
   * @param {Object} [options.payload] - Optional event payload
   *
   */
  error({ group, name, payload }) {
    return this._emit(group, name, 'error', payload);
  }

}

module.exports = new Telemetry();
