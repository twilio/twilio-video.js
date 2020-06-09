'use strict';

const DataTrackTransceiver = require('./transceiver');
const makeUUID = require('../util').makeUUID;

/**
 * A {@link DataTrackSender} represents a {@link DataTrackTransceiver} over
 * which data can be sent. Internally, it uses a collection of RTCDataChannels
 * to send data.
 * @extends DataTrackTransceiver
 */
class DataTrackSender extends DataTrackTransceiver {
  /**
   * Construct a {@link DataTrackSender}.
   * @param {?number} maxPacketLifeTime
   * @param {?number} maxRetransmits
   * @param {boolean} ordered
   */
  constructor(maxPacketLifeTime, maxRetransmtis, ordered) {
    super(makeUUID(), maxPacketLifeTime, maxRetransmtis, ordered);
    Object.defineProperties(this, {
      _clones: {
        value: new Set()
      },
      _dataChannels: {
        value: new Set()
      }
    });
  }

  /**
   * Add a cloned {@link DataTrackSender}.
   * @private
   * @returns {void}
   */
  _addClone(clone) {
    this._clones.add(clone);
  }

  /**
   * Remove a cloned {@link DataTrackSender}.
   * @returns {void}
   */
  removeClone(clone) {
    this._clones.delete(clone);
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
   * Return a new {@link DataTrackSender}. Any message sent over this
   * {@link DataTrackSender} will also be sent over the clone. Whenever this
   * {@link DataTrackSender} is stopped, so to will the clone.
   * @returns {DataTrackSender}
   */
  clone() {
    const clone = new DataTrackSender(
      this.maxPacketLifeTime,
      this.maxRetransmits,
      this.ordered);
    this._addClone(clone);
    clone.once('stopped', () => this.removeClone(clone));
    return clone;
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
    this._clones.forEach(clone => {
      try {
        clone.send(data);
      } catch (error) {
        // Do nothing.
      }
    });
    return this;
  }

  stop() {
    this._dataChannels.forEach(dataChannel => dataChannel.close());
    this._clones.forEach(clone => clone.stop());
    super.stop();
  }
}

module.exports = DataTrackSender;
