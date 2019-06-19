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
      },
      _messageQueue: {
        value: []
      }
    });

    dataChannel.addEventListener('open', () => {
      this._messageQueue.splice(0).forEach(message => this._publish(message));
    });

    dataChannel.addEventListener('message', ({ data }) => {
      try {
        const message = JSON.parse(data);
        this.emit('message', message);
      } catch (error) {
        // Do nothing.
      }
    });

    this.publish({ type: 'ready' });
  }

  /**
   * @param message
   * @private
   */
  _publish(message) {
    const data = JSON.stringify(message);
    try {
      this._dataChannel.send(data);
    } catch (error) {
      // Do nothing.
    }
  }

  /**
   * Publish a message. Returns true if calling the method resulted in
   * publishing (or eventually publishing) the update.
   * @param {object} message
   * @returns {boolean}
   */
  publish(message) {
    const dataChannel = this._dataChannel;
    if (dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
      return false;
    }
    if (dataChannel.readyState === 'connecting') {
      this._messageQueue.push(message);
      return true;
    }
    this._publish(message);
    return true;
  }
}

/**
 * The {@link DataTransport} received a message.
 * @event DataTransport#message
 * @param {object} message
 */

module.exports = DataTransport;
