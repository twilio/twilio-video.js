'use strict';

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
 *     saveData?: boolean,     // user has set reduced data usage
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
    const networkChangeHandler = () => {
      if (typeof navigator === 'undefined' || !navigator.connection) {
        return;
      }
      const connection = navigator.connection;
      const networkInfo = {
        downlink: connection.downlink,
        downlinkMax: connection.downlinkMax,
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        saveData: connection.saveData,
        type: connection.type
      };
      this._publishEvent('network', 'network-information-changed', 'info', networkInfo);
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.connection) {
        ['change', 'typechange'].forEach(eventType => {
          navigator.connection.addEventListener(eventType, networkChangeHandler);
        });

        this._networkMonitor = {
          stop: () => {
            ['change', 'typechange'].forEach(eventType => {
              navigator.connection.removeEventListener(eventType, networkChangeHandler);
            });
          }
        };
      }
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
