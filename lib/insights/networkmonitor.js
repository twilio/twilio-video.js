'use strict';

const { boolToString } = require('../util');

/**
 * NetworkMonitor handles publishing network events from the Network Information API
 * to the Insights gateway.
 *
 * The Network Information API provides information about the system's connection such as
 * bandwidth, connection type, etc. This is separate from WebRTC ICE candidate network detection.
 *
 * @example
 * const networkMonitor = new NetworkMonitor(eventObserver, log);
 *
 * // Events published:
 * // - group: 'network', name: 'network-information-changed'
 * // - payload: { downlink, effectiveType, rtt, saveData, type }
 *
 * // Clean up when done
 * networkMonitor.cleanup();
 */
class NetworkMonitor {
  /**
   * Create a NetworkMonitor
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
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
      const networkInfo = {
        downlink: connection.downlink,
        downlinkMax: connection.downlinkMax,
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        saveData: typeof connection.saveData === 'boolean' ? boolToString(connection.saveData) : undefined,
        type: connection.type
      };
      this._eventObserver.emit('event', {
        group: 'network',
        name: 'network-information-changed',
        level: 'info',
        payload: networkInfo
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
