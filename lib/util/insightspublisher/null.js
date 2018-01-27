'use strict';

/**
 * Null Insights publisher.
 * @constructor
 */
class InsightsPublisher {
  constructor() {
    Object.defineProperties(this, {
      _connected: {
        writable: true,
        value: true
      }
    });
  }

  /**
   * Disconnect.
   * @returns {boolean}
   */
  disconnect() {
    if (this._connected) {
      this._connected = false;
      return true;
    }
    return false;
  }

  /**
   * Publish.
   * @returns {boolean}
   */
  publish() {
    return this._connected;
  }
}

module.exports = InsightsPublisher;
