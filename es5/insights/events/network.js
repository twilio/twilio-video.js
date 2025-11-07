'use strict';
/**
 * Network telemetry events
 * @internal
 */
var NetworkEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function NetworkEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit when network type changes (from ICE candidate)
     * @param {string} networkType - Network type: 'wifi', 'cellular', 'ethernet', 'vpn', etc.
     * @returns {void}
     */
    NetworkEvents.prototype.typeChanged = function (networkType) {
        this._telemetry.info({
            group: 'network',
            name: 'network-type-changed',
            payload: { networkType: networkType }
        });
    };
    /**
     * Emit when network information changes (from Network Information API)
     * @param {Object} info - Network information
     * @param {number} [info.downlink] - Downlink speed in Mbps
     * @param {number} [info.downlinkMax] - Maximum downlink speed in Mbps
     * @param {('slow-2g'|'2g'|'3g'|'4g')} [info.effectiveType] - Effective connection type
     * @param {number} [info.rtt] - Round-trip time in milliseconds
     * @param {string} [info.saveData] - Data saver mode: 'true' or 'false'
     * @param {('bluetooth'|'cellular'|'ethernet'|'none'|'wifi'|'wimax'|'other'|'unknown')} [info.type] - Connection type
     * @returns {void}
     */
    NetworkEvents.prototype.informationChanged = function (_a) {
        var downlink = _a.downlink, downlinkMax = _a.downlinkMax, effectiveType = _a.effectiveType, rtt = _a.rtt, saveData = _a.saveData, type = _a.type;
        this._telemetry.info({
            group: 'network',
            name: 'network-information-changed',
            payload: {
                downlink: downlink,
                downlinkMax: downlinkMax,
                effectiveType: effectiveType,
                rtt: rtt,
                saveData: saveData,
                type: type
            }
        });
    };
    return NetworkEvents;
}());
module.exports = NetworkEvents;
//# sourceMappingURL=network.js.map