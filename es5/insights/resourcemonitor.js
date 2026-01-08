'use strict';
var computePressureMonitor = require('./computepressuremonitor');
var telemetry = require('./telemetry');
/**
 * ResourceMonitor handles publishing system resource events to the Insights gateway.
 * @internal
 */
var ResourceMonitor = /** @class */ (function () {
    /**
     * Create a ResourceMonitor
     * @param {Log} log - Logger instance
     */
    function ResourceMonitor(log) {
        if (!log) {
            throw new Error('ResourceMonitor requires a log instance');
        }
        this._log = log;
        this._cpuPressureHandler = null;
        this._setupCPUMonitoring();
    }
    /**
     * Setup CPU pressure monitoring
     * @private
     */
    ResourceMonitor.prototype._setupCPUMonitoring = function () {
        var _this = this;
        if (!computePressureMonitor.isSupported()) {
            this._log.debug('CPU pressure monitoring not supported');
            return;
        }
        this._cpuPressureHandler = function (pressureRecord) {
            _this._log.debug('CPU pressure changed:', pressureRecord);
            telemetry.system.cpuPressureChanged(pressureRecord.state);
        };
        computePressureMonitor.watchCpuPressure(this._cpuPressureHandler)
            .then(function () {
            _this._log.debug('CPU pressure monitoring initialized');
        })
            .catch(function (error) {
            _this._log.error('Error initializing CPU pressure monitoring:', error);
        });
    };
    /**
     * Cleanup all resource monitors
     */
    ResourceMonitor.prototype.cleanup = function () {
        this._log.debug('Cleaning up resource monitors');
        if (this._cpuPressureHandler) {
            computePressureMonitor.unwatchCpuPressure(this._cpuPressureHandler);
            this._cpuPressureHandler = null;
        }
    };
    return ResourceMonitor;
}());
module.exports = ResourceMonitor;
//# sourceMappingURL=resourcemonitor.js.map