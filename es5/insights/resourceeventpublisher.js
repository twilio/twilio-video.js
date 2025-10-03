'use strict';
var computePressureMonitor = require('./computepressuremonitor');
/**
 * ResourceEventPublisher handles publishing system resource events to the Twilio Video SDK insights.
 *
 * @example
 * const resourceEventPublisher = new ResourceEventPublisher(eventObserver, log);
 * resourceEventPublisher.cleanup();
 *
 * // Any change in resource monitoring will be published to the event observer using the following format:
 * {
 *   group: 'system',
 *   name: 'cpu-pressure-changed',
 *   level: 'info',
 *   payload: {
 *     resourceType: 'cpu',
 *     pressure: 'nominal' | 'fair' | 'serious' | 'critical'
 *   }
 * }
 *
 * // Since CPU pressure will be monitored continuously, it is important to clean up the resource monitors
 * // when the SDK no longer needs this information.
 * resourceEventPublisher.cleanup();
 */
var ResourceEventPublisher = /** @class */ (function () {
    /**
     * Create a ResourceEventPublisher
     * @param {EventObserver} eventObserver - The event observer for publishing insights
     * @param {Log} log - Logger instance
     */
    function ResourceEventPublisher(eventObserver, log) {
        this._eventObserver = eventObserver;
        this._cpuPressureHandler = null;
        this._log = log;
        this._setupCPUMonitoring();
    }
    /**
     * Setup CPU pressure monitoring
     * @private
     */
    ResourceEventPublisher.prototype._setupCPUMonitoring = function () {
        var _this = this;
        if (!computePressureMonitor.isSupported()) {
            this._log.debug('CPU pressure monitoring not supported');
            return;
        }
        this._cpuPressureHandler = function (pressureRecord) {
            _this._log.debug('CPU pressure changed:', pressureRecord);
            _this._publishEvent('system', 'cpu-pressure-changed', 'info', {
                resourceType: 'cpu',
                pressure: pressureRecord.state
            });
        };
        try {
            computePressureMonitor.onCpuPressureChange(this._cpuPressureHandler);
            this._log.debug('CPU pressure monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing CPU pressure monitoring:', error);
        }
    };
    /**
     * Publish a resource monitoring event
     * @param {string} group - Event group
     * @param {string} name - Event name
     * @param {string} level - Event level
     * @param {Object} payload - Event payload
     * @private
     */
    ResourceEventPublisher.prototype._publishEvent = function (group, name, level, payload) {
        this._eventObserver.emit('event', {
            group: group,
            name: name,
            level: level,
            payload: payload
        });
    };
    /**
     * Cleanup all resource monitors
     */
    ResourceEventPublisher.prototype.cleanup = function () {
        this._log.debug('Cleaning up resource monitors');
        if (this._cpuPressureHandler) {
            computePressureMonitor.offCpuPressureChange(this._cpuPressureHandler);
            this._cpuPressureHandler = null;
        }
    };
    return ResourceEventPublisher;
}());
module.exports = ResourceEventPublisher;
//# sourceMappingURL=resourceeventpublisher.js.map