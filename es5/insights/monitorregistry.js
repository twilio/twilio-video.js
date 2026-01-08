'use strict';
var ApplicationMonitor = require('./applicationmonitor');
var NetworkMonitor = require('./networkmonitor');
var ResourceMonitor = require('./resourcemonitor');
/**
 * MonitorRegistry manages insight monitors for a Room.
 * @internal
 */
var MonitorRegistry = /** @class */ (function () {
    /**
     * Create a MonitorRegistry with standard room monitors
     * @param {Log} log - Logger instance
     */
    function MonitorRegistry(log) {
        if (!log) {
            throw new Error('MonitorRegistry requires a log instance');
        }
        this._log = log;
        this._monitors = [
            new ApplicationMonitor(log),
            new NetworkMonitor(log),
            new ResourceMonitor(log)
        ];
    }
    /**
     * Clean up all monitors
     * Continues cleanup even if individual monitors throw errors
     */
    MonitorRegistry.prototype.cleanup = function () {
        var _this = this;
        this._monitors.forEach(function (monitor) {
            try {
                monitor.cleanup();
            }
            catch (err) {
                _this._log.warn('Failed to cleanup monitor:', err);
            }
        });
    };
    return MonitorRegistry;
}());
module.exports = MonitorRegistry;
//# sourceMappingURL=monitorregistry.js.map