'use strict';

/**
 * Network telemetry events
 * @internal
 */
class NetworkEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when network type changes (from ICE candidate)
   * @param {string} networkType - Network type: 'wifi', 'cellular', 'ethernet', 'vpn', etc.
   * @returns {void}
   */
  typeChanged(networkType) {
    this._telemetry.info({
      group: 'network',
      name: 'network-type-changed',
      payload: { networkType }
    });
  }

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
  informationChanged({ downlink, downlinkMax, effectiveType, rtt, saveData, type }) {
    this._telemetry.info({
      group: 'network',
      name: 'network-information-changed',
      payload: {
        downlink,
        downlinkMax,
        effectiveType,
        rtt,
        saveData,
        type
      }
    });
  }
}

module.exports = NetworkEvents;
