'use strict';

const DataTrackTransceiver = require('./transceiver');
const makeUUID = require('../util').makeUUID;

/**
 * Construct a {@link DataTrackSender}.
 * @class
 * @classdesc A {@link DataTrackSender} represents a
 *   {@link DataTrackTransceiver} over which data can be sent. Internally, it uses a
 *   collection of RTCDataChannels to send data.
 * @extends DataTrackTransceiver
 * @param {?number} maxPacketLifeTime
 * @param {?number} maxRetransmits
 * @param {boolean} ordered
 */
class DataTrackSender extends DataTrackTransceiver {
  constructor(maxPacketLifeTime, maxRetransmtis, ordered) {
    const id = makeUUID();
    super(id, maxPacketLifeTime, maxRetransmtis, ordered);
    Object.defineProperties(this, {
      _dataChannels: {
        value: new Set()
      }
    });
  }

  /**
   * Add an RTCDataChannel to the {@link DataTrackSender}.
   * @param {RTCDataChannel} dataChannel
   * @returns {this}
   */
  addDataChannel(dataChannel) {
    this._dataChannels.add(dataChannel);
    return this;
  }

  /**
   * Remove an RTCDataChannel from the {@link DataTrackSender}.
   * @param {RTCDataChannel} dataChannel
   * @returns {this}
   */
  removeDataChannel(dataChannel) {
    this._dataChannels.delete(dataChannel);
    return this;
  }

  /**
   * Send data over the {@link DataTrackSender}. Internally, this calls
   * <code>send</code> over each of the underlying RTCDataChannels.
   * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
   * @returns {this}
   */
  send(data) {
    this._dataChannels.forEach(dataChannel => {
      try {
        dataChannel.send(data);
      } catch (error) {
        // Do nothing.
      }
    });
    return this;
  }
}

module.exports = DataTrackSender;
