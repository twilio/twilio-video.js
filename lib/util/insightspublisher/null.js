'use strict';

/**
 * Null Insights publisher.
 * @constructor
 */
function InsightsPublisher() {
  if (!(this instanceof InsightsPublisher)) {
    return new InsightsPublisher();
  }
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
InsightsPublisher.prototype.disconnect = function disconnect() {
  if (this._connected) {
    this._connected = false;
    return true;
  }
  return false;
};

/**
 * Publish.
 * @returns {boolean}
 */
InsightsPublisher.prototype.publish = function publish() {
  return this._connected;
};

module.exports = InsightsPublisher;
