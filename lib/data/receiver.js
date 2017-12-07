'use strict';

var inherits = require('util').inherits;
var DataTrackTransceiver = require('./transceiver');

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
function DataTrackReceiver(dataChannel) {
  if (!(this instanceof DataTrackReceiver)) {
    return new DataTrackReceiver(dataChannel);
  }
  DataTrackTransceiver.call(this,
    dataChannel.label,
    dataChannel.maxPacketLifeTime,
    dataChannel.maxRetransmits,
    dataChannel.ordered);

  // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
  // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
  // and Safari.
  dataChannel.binaryType = 'arraybuffer';

  var self = this;
  dataChannel.addEventListener('message', function(event) {
    self.emit('message', event.data);
  });
}

inherits(DataTrackReceiver, DataTrackTransceiver);

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

module.exports = DataTrackReceiver;
