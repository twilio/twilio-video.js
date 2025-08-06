'use strict';

const documentVisibilityMonitor = require('../util/documentvisibilitymonitor');

/**
 * ApplicationEventPublisher handles publishing application lifecycle events to the Twilio Video SDK insights.
 *
 * Note: the eventObserver name is used widely in the SDK to refer to the InsightsPublisher,
 * a class that publishes events to the Insights gateway.
 *
 * @example
 * const applicationEventPublisher = new ApplicationEventPublisher(eventObserver, log);
 *
 * // Application visibility events will be published to the event observer using the following format:
 * {
 *   group: 'application',
 *   name: 'resumed' | 'backgrounded',
 *   level: 'info'
 * }
 *
 * // Clean up when no longer needed
 * applicationEventPublisher.cleanup();
 */
class ApplicationEventPublisher {
  /**
   * Create an ApplicationEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
    this._visibilityChangeHandler = null;

    this._setupVisibilityMonitoring();
  }

  /**
   * Setup application visibility monitoring
   * @private
   */
  _setupVisibilityMonitoring() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this._log.debug('Not in browser environment, skipping setup of ApplicationEventPublisher');
      return;
    }

    this._visibilityChangeHandler = isVisible => this._handleVisibilityChange(isVisible);

    try {
      documentVisibilityMonitor.onVisibilityChange(1, this._visibilityChangeHandler);
      this._log.debug('ApplicationEventPublisher visibility monitoring initialized');
    } catch (error) {
      this._log.error('Error initializing ApplicationEventPublisher visibility monitoring:', error);
    }
  }

  /**
   * Cleanup all application event monitors
   */
  cleanup() {
    this._log.debug('Cleaning up application event monitors');

    if (this._visibilityChangeHandler) {
      documentVisibilityMonitor.offVisibilityChange(1, this._visibilityChangeHandler);
      this._visibilityChangeHandler = null;
    }
  }


  /**
   * Handle document visibility changes.
   * @private
   * @param {boolean} isVisible - Whether the application is visible or not
   * @returns {void}
   */
  _handleVisibilityChange(isVisible) {
    const eventName = isVisible ? 'resumed' : 'backgrounded';

    this._publishEvent(eventName);
  }

  /**
   * Publish an event through the EventObserver.
   * @private
   * @param {string} name - Event name
   * @param {string} level - Event level (debug, info, warning, error)
   */
  _publishEvent(name, level = 'info') {
    try {
      this._eventObserver.emit('event', {
        group: 'application',
        name,
        level
      });
    } catch (error) {
      this._log.error(`ApplicationEventPublisher: Error publishing event ${name}:`, error);
    }
  }

}

module.exports = ApplicationEventPublisher;
