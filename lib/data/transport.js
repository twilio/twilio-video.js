'use strict';

const { EventEmitter } = require('events');

/**
 * @classdesc A {@link DataTransport} implements {@link MediaSignalingTransport}
 *   in terms of an RTCDataChannel.
 * @extends EventEmitter
 * @implements MediaSignalingTransport
 * @emits DataTransport#message
 */
class DataTransport extends EventEmitter {
  /**
   * Construct a {@link DataTransport}.
   * @param {RTCDataChannel} dataChannel
   */
  constructor(dataChannel) {
    super();

    Object.defineProperties(this, {
      _dataChannel: {
        value: dataChannel
      }
    });

    dataChannel.addEventListener('message', ({ data }) => {
      try {
        const message = JSON.parse(data);
        this.emit('message', message);
      } catch (error) {
        // Do nothing.
      }
    });
  }

  /**
   * Publish a message. Returns true if calling the method resulted in
   * publishing (or eventually publishing) the update.
   * @param {object} message
   * @returns {boolean}
   */
  publish(message) {
    try {
      const data = JSON.stringify(message);
      this._dataChannel.send(data);
    } catch (error) {
      return false;
    }
    return true;
  }
}

/**
 * The {@link DataTransport} received a message.
 * @event DataTransport#message
 * @param {object} message
 */

module.exports = DataTransport;
