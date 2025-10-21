'use strict';

const documentVisibilityMonitor = require('../util/documentvisibilitymonitor');

/**
 * ApplicationMonitor handles publishing application lifecycle events to the Insights gateway.
 *
 * @example
 * const applicationMonitor = new ApplicationMonitor(eventObserver, log);
 *
 * // Application visibility events will be published to the event observer using the following format:
 * {
 *   group: 'application',
 *   name: 'resumed' | 'backgrounded',
 *   level: 'info'
 * }
 *
 * // Clean up when no longer needed
 * applicationMonitor.cleanup();
 */
class ApplicationMonitor {
  /**
   * Create an ApplicationMonitor
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
    this._visibilityChangeHandler = null;
    this._boundHandleBeforeUnload = this._handleBeforeUnload.bind(this);

    this._setupVisibilityMonitoring();
    this._setupBeforeUnloadMonitoring();
  }

  /**
   * Setup application visibility monitoring
   * @private
   */
  _setupVisibilityMonitoring() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this._log.debug('Not in browser environment, skipping setup of ApplicationMonitor');
      return;
    }

    this._visibilityChangeHandler = isVisible => this._handleVisibilityChange(isVisible);

    try {
      documentVisibilityMonitor.onVisibilityChange(1, this._visibilityChangeHandler);
      this._log.debug('ApplicationMonitor visibility monitoring initialized');
    } catch (error) {
      this._log.error('Error initializing ApplicationMonitor visibility monitoring:', error);
    }
  }

  /**
   * Setup application beforeunload monitoring
   * @private
   */
  _setupBeforeUnloadMonitoring() {
    try {
      window.addEventListener('beforeunload', this._boundHandleBeforeUnload);
      this._log.debug('ApplicationMonitor beforeunload monitoring initialized');
    } catch (error) {
      this._log.error('Error initializing ApplicationMonitor beforeunload monitoring:', error);
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

    if (typeof window !== 'undefined' && this._boundHandleBeforeUnload) {
      window.removeEventListener('beforeunload', this._boundHandleBeforeUnload);
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
    this._eventObserver.emit('event', {
      group: 'application',
      name: eventName,
      level: 'info',
    });
  }

  /**
   * Handle beforeunload event
   * @private
   * @returns {void}
   */
  _handleBeforeUnload() {
    this._eventObserver.emit('event', {
      group: 'application',
      name: 'terminated',
      level: 'info',
    });
  }
}

module.exports = ApplicationMonitor;
