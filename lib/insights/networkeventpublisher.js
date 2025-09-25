'use strict';
const { boolToString } = require('../util');

// NOTE(lrivas): We can remove these typedefs if we update Typescript to 4.4+ and use the built-in DOM types
// https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1029#issuecomment-869224737

/**
 * @internal
 * @typedef {object} NetworkInformation
 * @property {number} [downlink]
 * @property {number} [downlinkMax]
 * @property {string} [effectiveType]
 * @property {number} [rtt]
 * @property {boolean} [saveData]
 * @property {string} [type]
 * @property {(event: 'change' | 'typechange', listener: () => void) => void} addEventListener
 * @property {(event: 'change' | 'typechange', listener: () => void) => void} removeEventListener
 */
/**
 * @internal
 * @typedef {Navigator & { connection?: NetworkInformation }} NavigatorWithConnection
 */

/**
 * NetworkEventPublisher handles publishing network information events to the Twilio Video SDK insights.
 *
 * @example
 * const networkEventPublisher = new NetworkEventPublisher(eventObserver, log);
 *
 * // Network information changes are published in the following format:
 * {
 *   group: 'network',
 *   name: 'network-information-changed',
 *   level: 'info',
 *   payload: {
 *     downlink?: number,      // effective bandwidth estimate in Mbps
 *     downlinkMax?: number,   // maximum downlink speed in Mbps
 *     effectiveType?: string, // 'slow-2g', '2g', '3g', or '4g'
 *     rtt?: number,           // estimated round-trip time in ms
 *     saveData?: 'true' | 'false', // stringified bool indicating reduced data usage preference
 *     type?: string           // connection type: 'bluetooth', 'cellular', 'ethernet', etc.
 *   }
 * }
 *
 * // Clean up when no longer needed
 * networkEventPublisher.cleanup();
 */
class NetworkEventPublisher {
  /**
   * Create a NetworkEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
    this._networkMonitor = null;

    this._setupNetworkMonitoring();
  }

  /**
   * Setup network information monitoring
   * @private
   */
  _setupNetworkMonitoring() {
    if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator.connection) {
      this._log.warn('NetworkInformation not supported');
      return;
    }

    const networkChangeHandler = () => {
      const connection = /** @type {NavigatorWithConnection} */ (navigator).connection;
      const networkInfo = {
        downlink: connection.downlink,
        downlinkMax: connection.downlinkMax,
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        // eslint-disable-next-line no-undefined
        saveData: typeof connection.saveData === 'boolean' ? boolToString(connection.saveData) : undefined,
        type: connection.type
      };
      this._publishEvent('network', 'network-information-changed', 'info', networkInfo);
    };

    try {
      const connection = /** @type {NavigatorWithConnection} */ (navigator).connection;
      ['change', 'typechange'].forEach(eventType => {
        connection.addEventListener(eventType, networkChangeHandler);
      });

      this._networkMonitor = {
        stop: () => {
          ['change', 'typechange'].forEach(eventType => {
            connection.removeEventListener(eventType, networkChangeHandler);
          });
        }
      };
    } catch (error) {
      this._log.error('Error initializing network information monitoring:', error);
    }
  }


  /**
   * Publish a network monitoring event
   * @param {string} group - Event group
   * @param {string} name - Event name
   * @param {string} level - Event level
   * @param {Object} payload - Event payload
   * @private
   */
  _publishEvent(group, name, level, payload) {
    try {
      this._eventObserver.emit('event', {
        group,
        name,
        level,
        payload
      });
    } catch (error) {
      this._log.error(`NetworkEventPublisher: Error publishing event ${name}:`, error);
    }
  }


  /**
   * Cleanup all network monitors
   */
  cleanup() {
    if (this._networkMonitor) {
      this._networkMonitor.stop();
      this._networkMonitor = null;
    }
  }
}

module.exports = NetworkEventPublisher;
