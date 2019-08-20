// eslint-disable-next-line no-warning-comments
// TODO(mroberts): This should be described as implementing some
// InsightsPublisher interface.
'use strict';

/**
 * Null Insights publisher.
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
   * Connect
   * @returns {void}
   */
  connect() {
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
