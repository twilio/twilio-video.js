'use strict';

const EventEmitter = require('events');

/**
 * Telemetry is a singleton event bus for emitting telemetry events throughout the SDK.
 * It decouples event emission from observer management, allowing different parts of the SDK
 * to emit events without direct coupling.
 *
 * @example
 * const telemetry = require('./insights/telemetry');
 *
 * telemetry.registerObserver(eventObserver);
 *
 * // Emit events using convenience methods
 * telemetry.info({ group: 'get-user-media', name: 'succeeded' });
 * telemetry.warning({ group: 'quality', name: 'degraded', payload: { reason: 'cpu' } });
 * telemetry.error({ group: 'connection', name: 'failed', payload: { error: 'timeout' } });
 *
 * // Later - cleanup
 * telemetry.unregisterObserver();
 *
 * @extends EventEmitter
 */
class Telemetry extends EventEmitter {
  constructor() {
    super();
    this._activeObserver = null;
    this._handleTelemetryEvent = this._handleTelemetryEvent.bind(this);
  }

  /**
   * Register an observer for telemetry events.
   * Only one observer can be active at a time. Registering a new observer
   * will automatically unregister the previous one.
   *
   * @param {EventObserver} observer - The event observer to register
   */
  registerObserver(observer) {
    if (this._activeObserver) {
      this.unregisterObserver();
    }

    this._activeObserver = observer;
    this.on('telemetry', this._handleTelemetryEvent);
  }

  /**
   * Unregister the current observer and stop forwarding events.
   */
  unregisterObserver() {
    this.removeListener('telemetry', this._handleTelemetryEvent);
    this._activeObserver = null;
  }

  /**
   * Check if an observer is currently registered.
   * @returns {boolean} True if an observer is registered
   */
  get isEnabled() {
    return this._activeObserver !== null;
  }

  /**
   * Internal method to emit a telemetry event. If no observer is registered, the event is ignored.
   * @private
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} options.name - Event name (e.g., 'succeeded', 'failed')
   * @param {string} options.level - Event level ('info', 'warning', 'error') - required
   * @param {Object} [options.payload] - Optional event payload
   */
  _emit({ group, name, level, payload }) {
    if (!this._activeObserver) {
      return;
    }

    const event = { group, name, level };
    if (payload !== undefined) {
      event.payload = payload;
    }

    super.emit('telemetry', event);
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

  /**
   * Handle telemetry events and forward to the active observer.
   * @private
   * @param {Object} event - The telemetry event
   */
  _handleTelemetryEvent(event) {
    if (!this._activeObserver) {
      return;
    }

    this._activeObserver.emit('event', event);
  }
}

module.exports = new Telemetry();
