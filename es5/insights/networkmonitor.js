'use strict';
var boolToString = require('../util').boolToString;
var telemetry = require('./telemetry');
/**
 * NetworkMonitor handles publishing network events from the Network Information API
 * to the Insights gateway.
 * @internal
 */
var NetworkMonitor = /** @class */ (function () {
    /**
     * Create a NetworkMonitor
     * @param {Log} log - Logger instance
     */
    function NetworkMonitor(log) {
        if (!log) {
            throw new Error('NetworkMonitor requires a log instance');
        }
        this._log = log;
        this._networkInformationHandler = null;
        this._setupNetworkInformationAPI();
    }
    /**
     * Setup Network Information API monitoring for connection changes
     * @private
     */
    NetworkMonitor.prototype._setupNetworkInformationAPI = function () {
        if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator.connection) {
            this._log.debug('Network Information API not supported');
            return;
        }
        var networkChangeHandler = function () {
            var connection = /** @type {any} */ (navigator).connection;
            telemetry.network.informationChanged({
                downlink: connection.downlink,
                downlinkMax: connection.downlinkMax,
                effectiveType: connection.effectiveType,
                rtt: connection.rtt,
                saveData: typeof connection.saveData === 'boolean' ? boolToString(connection.saveData) : undefined,
                type: connection.type
            });
        };
        try {
            var connection_1 = /** @type {any} */ (navigator).connection;
            ['change', 'typechange'].forEach(function (eventType) {
                connection_1.addEventListener(eventType, networkChangeHandler);
            });
            this._networkInformationHandler = {
                stop: function () {
                    ['change', 'typechange'].forEach(function (eventType) {
                        connection_1.removeEventListener(eventType, networkChangeHandler);
                    });
                }
            };
            this._log.debug('Network Information API monitoring initialized');
        }
        catch (error) {
            this._log.error('Error initializing Network Information API monitoring:', error);
        }
    };
    /**
     * Cleanup network monitoring
     */
    NetworkMonitor.prototype.cleanup = function () {
        this._log.debug('Cleaning up network monitoring');
        if (this._networkInformationHandler) {
            this._networkInformationHandler.stop();
            this._networkInformationHandler = null;
        }
    };
    return NetworkMonitor;
}());
module.exports = NetworkMonitor;
//# sourceMappingURL=networkmonitor.js.map