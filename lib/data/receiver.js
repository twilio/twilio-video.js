'use strict';

const DataTrackTransceiver = require('./transceiver');

/**
 * Construct an {@link DataTrackReceiver}.
 * @class
 * @classdesc A {@link DataTrackReceiver} represents a
 *   {@link DataTrackTransceiver} over which data can be received. Internally, it
 *   users a single RTCDataChannel to receive data.
 * @extends DataTrackTransceiver
 * @param {RTCDataChannel} dataChannel
 * @fires DataTrackReceiver#message
 */
class DataTrackReceiver extends DataTrackTransceiver {
  constructor(dataChannel) {
    super(
      dataChannel.label,
      dataChannel.maxPacketLifeTime,
      dataChannel.maxRetransmits,
      dataChannel.ordered
    );

    // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
    // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
    // and Safari.
    dataChannel.binaryType = 'arraybuffer';

    const self = this;
    dataChannel.addEventListener('message', event => {
      self.emit('message', event.data);
    });
  }
}

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

module.exports = DataTrackReceiver;
