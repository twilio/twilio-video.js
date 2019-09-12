'use strict';

const DataTrackTransceiver = require('./transceiver');
const DataTransport = require('./transport');

/**
 * A {@link DataTrackReceiver} represents a {@link DataTrackTransceiver} over
 * which data can be received. Internally, it users a single RTCDataChannel to
 * receive data.
 * @extends DataTrackTransceiver
 * @emits DataTrackReceiver#message
 * @emits DataTrackReceiver#close
 */
class DataTrackReceiver extends DataTrackTransceiver {
  /**
   * Construct an {@link DataTrackReceiver}.
   * @param {RTCDataChannel} dataChannel
   */
  constructor(dataChannel) {
    super(
      dataChannel.label,
      dataChannel.maxPacketLifeTime,
      dataChannel.maxRetransmits,
      dataChannel.ordered
    );

    Object.defineProperties(this, {
      _dataChannel: {
        value: dataChannel
      }
    });

    // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
    // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
    // and Safari.
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.addEventListener('message', event => {
      this.emit('message', event.data);
    });

    dataChannel.addEventListener('close', () => {
      this.emit('close');
    });
  }

  /**
   * Create a {@link DataTransport} from the {@link DataTrackReceiver}.
   * @returns {DataTransport}
   */
  toDataTransport() {
    return new DataTransport(this._dataChannel);
  }
}

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

/**
 * @event DataTrackReceiver#close
 */

module.exports = DataTrackReceiver;
