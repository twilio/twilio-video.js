'use strict';

const { boolToString } = require('../util');
const telemetry = require('./telemetry');

/**
 * NetworkMonitor handles publishing network events from the Network Information API
 * to the Insights gateway.
 * @internal
 */
class NetworkMonitor {
  /**
   * Create a NetworkMonitor
   * @param {Log} log - Logger instance
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
    if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator.connection) {
      this._log.debug('Network Information API not supported');
      return;
    }

    const networkChangeHandler = () => {
      const connection = /** @type {any} */ (navigator).connection;
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
