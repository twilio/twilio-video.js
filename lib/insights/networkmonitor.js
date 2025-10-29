'use strict';

const { boolToString } = require('../util');
const telemetry = require('./telemetry');

/**
 * @typedef {Object} NetworkInformationData
 * @property {number|undefined} downlink
 * @property {number|undefined} downlinkMax
 * @property {string|undefined} effectiveType
 * @property {number|undefined} rtt
 * @property {string|undefined} saveData
 * @property {string|undefined} type
 */

/**
 * NetworkMonitor handles publishing network events from the Network Information API
 * to the Insights gateway.
 * @internal
 */
class NetworkMonitor {
  /**
   * Create a NetworkMonitor
   * @param {import('../util/log')} log - Logger instance
   */
  constructor(log) {
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
  _setupNetworkInformationAPI() {
    if (typeof globalThis.navigator === 'undefined' || !('connection' in globalThis.navigator)) {
      this._log.debug('Network Information API not supported');
      return;
    }

    const networkChangeHandler = () => {
      /** @type {NetworkInformationData} */
      const connection = (navigator).connection;
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
      const connection = /** @type {any} */ (navigator).connection;
      ['change', 'typechange'].forEach(eventType => {
        connection.addEventListener(eventType, networkChangeHandler);
      });

      this._networkInformationHandler = {
        stop: () => {
          ['change', 'typechange'].forEach(eventType => {
            connection.removeEventListener(eventType, networkChangeHandler);
          });
        }
      };

      this._log.debug('Network Information API monitoring initialized');
    } catch (error) {
      this._log.error('Error initializing Network Information API monitoring:', error);
    }
  }

  /**
   * Cleanup network monitoring
   */
  cleanup() {
    this._log.debug('Cleaning up network monitoring');

    if (this._networkInformationHandler) {
      this._networkInformationHandler.stop();
      this._networkInformationHandler = null;
    }
  }
}

module.exports = NetworkMonitor;
