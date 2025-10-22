'use strict';

const EventEmitter = require('events');

/**
 * Telemetry is a singleton event bus for emitting telemetry events throughout the SDK.
 * It decouples event emission from observer management, allowing different parts of the SDK
 * to emit events without direct coupling.
 *
 * @example
 * // In connect.js - register the observer
 * const telemetry = require('./insights/telemetry');
 *
 * telemetry.registerObserver(eventObserver);
 *
 * telemetry.emit({ group: 'get-user-media', name: 'succeeded', payload: { level: 'info' } });
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
   * Emit a telemetry event. If no observer is registered, the event is ignored.
   *
   * @param {Object} options - Event options
   * @param {string} options.group - Event group (e.g., 'get-user-media', 'quality', 'network')
   * @param {string} options.name - Event name (e.g., 'succeeded', 'failed')
   * @param {Object} [options.payload] - Optional event payload
   *
   * @example
   * telemetry.emit({ group: 'get-user-media', name: 'succeeded' });
   * // Emits: { name: 'succeeded', group: 'get-user-media', payload: { level: 'info' } }
   *
   * telemetry.emit({ group: 'get-user-media', name: 'failed', payload: { error: 'NotAllowed' } });
   * // Emits: { name: 'failed', group: 'get-user-media', payload: { level: 'info', error: 'NotAllowed' } }
   */
  emit({ group, name, payload }) {
    if (!this._activeObserver) {
      return;
    }

    const event = { group, name };
    if (payload !== undefined) {
      event.payload = payload;
    }

    super.emit('telemetry', event);
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

// Export singleton instance
module.exports = new Telemetry();
