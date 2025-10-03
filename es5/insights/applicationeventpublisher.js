'use strict';
var documentVisibilityMonitor = require('../util/documentvisibilitymonitor');
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
var ApplicationEventPublisher = /** @class */ (function () {
    /**
     * Create an ApplicationEventPublisher
     * @param {EventObserver} eventObserver - The event observer for publishing insights
     * @param {Log} log - Logger instance
     */
    function ApplicationEventPublisher(eventObserver, log) {
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
    ApplicationEventPublisher.prototype._setupVisibilityMonitoring = function () {
        var _this = this;
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            this._log.debug('Not in browser environment, skipping setup of ApplicationEventPublisher');
            return;
        }
        this._visibilityChangeHandler = function (isVisible) { return _this._handleVisibilityChange(isVisible); };
        try {
            documentVisibilityMonitor.onVisibilityChange(1, this._visibilityChangeHandler);
            this._log.debug('ApplicationEventPublisher visibility monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing ApplicationEventPublisher visibility monitoring:', error);
        }
    };
    /**
     * Setup application beforeunload monitoring
     * @private
     */
    ApplicationEventPublisher.prototype._setupBeforeUnloadMonitoring = function () {
        try {
            window.addEventListener('beforeunload', this._boundHandleBeforeUnload);
            this._log.debug('ApplicationEventPublisher beforeunload monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing ApplicationEventPublisher beforeunload monitoring:', error);
        }
    };
    /**
     * Cleanup all application event monitors
     */
    ApplicationEventPublisher.prototype.cleanup = function () {
        this._log.debug('Cleaning up application event monitors');
        if (this._visibilityChangeHandler) {
            documentVisibilityMonitor.offVisibilityChange(1, this._visibilityChangeHandler);
            this._visibilityChangeHandler = null;
        }
        if (typeof window !== 'undefined' && this._boundHandleBeforeUnload) {
            window.removeEventListener('beforeunload', this._boundHandleBeforeUnload);
        }
    };
    /**
     * Handle document visibility changes.
     * @private
     * @param {boolean} isVisible - Whether the application is visible or not
     * @returns {void}
     */
    ApplicationEventPublisher.prototype._handleVisibilityChange = function (isVisible) {
        var eventName = isVisible ? 'resumed' : 'backgrounded';
        this._publishEvent(eventName);
    };
    /**
     * Handle beforeunload event
     * @private
     * @returns {void}
     */
    ApplicationEventPublisher.prototype._handleBeforeUnload = function () {
        this._publishEvent('terminated');
    };
    /**
     * Publish an event through the EventObserver.
     * @private
     * @param {string} name - Event name
     * @param {string} level - Event level (debug, info, warning, error)
     */
    ApplicationEventPublisher.prototype._publishEvent = function (name, level) {
        if (level === void 0) { level = 'info'; }
        try {
            this._eventObserver.emit('event', {
                group: 'application',
                name: name,
                level: level
            });
        }
        catch (error) {
            this._log.error("ApplicationEventPublisher: Error publishing event " + name + ":", error);
        }
    };
    return ApplicationEventPublisher;
}());
module.exports = ApplicationEventPublisher;
//# sourceMappingURL=applicationeventpublisher.js.map