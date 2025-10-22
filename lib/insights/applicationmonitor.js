'use strict';

const documentVisibilityMonitor = require('../util/documentvisibilitymonitor');
const telemetry = require('./telemetry');

/**
 * ApplicationMonitor handles publishing application lifecycle events to the Insights gateway.
 *
 * @example
 * const applicationMonitor = new ApplicationMonitor(log);
 *
 * // Application visibility events will be published using telemetry with the following format:
 * {
 *   group: 'application',
 *   name: 'resumed' | 'backgrounded',
 *   payload: { level: 'info' }
 * }
 *
 * // Clean up when no longer needed
 * applicationMonitor.cleanup();
 */
class ApplicationMonitor {
  /**
   * Create an ApplicationMonitor
   * @param {Object} options - Monitor options
   * @param {Log} options.log - Logger instance (required)
   */
  constructor(options) {
    if (!options?.log) {
      throw new Error('ApplicationMonitor: options.log is required');
    }

    this._log = options.log;
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
    telemetry.info({
      group: 'application',
      name: eventName
    });
  }

  /**
   * Handle beforeunload event
   * @private
   * @returns {void}
   */
  _handleBeforeUnload() {
    telemetry.info({
      group: 'application',
      name: 'terminated'
    });
  }
}

module.exports = ApplicationMonitor;
