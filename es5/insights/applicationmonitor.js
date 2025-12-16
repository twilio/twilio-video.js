'use strict';
var documentVisibilityMonitor = require('../util/documentvisibilitymonitor');
var telemetry = require('./telemetry');
/**
 * ApplicationMonitor handles publishing application lifecycle events to the Insights gateway.
 * @internal
 */
var ApplicationMonitor = /** @class */ (function () {
    /**
     * Create an ApplicationMonitor
     * @param {Log} log - Logger instance
     */
    function ApplicationMonitor(log) {
        if (!log) {
            throw new Error('ApplicationMonitor requires a log instance');
        }
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
    ApplicationMonitor.prototype._setupVisibilityMonitoring = function () {
        var _this = this;
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            this._log.debug('Not in browser environment, skipping setup of ApplicationMonitor');
            return;
        }
        this._visibilityChangeHandler = function (isVisible) { return _this._handleVisibilityChange(isVisible); };
        try {
            documentVisibilityMonitor.onVisibilityChange(1, this._visibilityChangeHandler);
            this._log.debug('ApplicationMonitor visibility monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing ApplicationMonitor visibility monitoring:', error);
        }
    };
    /**
     * Setup application beforeunload monitoring
     * @private
     */
    ApplicationMonitor.prototype._setupBeforeUnloadMonitoring = function () {
        try {
            window.addEventListener('beforeunload', this._boundHandleBeforeUnload);
            this._log.debug('ApplicationMonitor beforeunload monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing ApplicationMonitor beforeunload monitoring:', error);
        }
    };
    /**
     * Cleanup all application event monitors
     */
    ApplicationMonitor.prototype.cleanup = function () {
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
    ApplicationMonitor.prototype._handleVisibilityChange = function (isVisible) {
        if (isVisible) {
            telemetry.application.resumed();
        }
        else {
            telemetry.application.backgrounded();
        }
    };
    /**
     * Handle beforeunload event
     * @private
     * @returns {void}
     */
    ApplicationMonitor.prototype._handleBeforeUnload = function () {
        telemetry.application.terminated();
    };
    return ApplicationMonitor;
}());
module.exports = ApplicationMonitor;
//# sourceMappingURL=applicationmonitor.js.map