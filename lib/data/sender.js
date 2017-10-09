'use strict';

var inherits = require('util').inherits;
var DataTrackTransceiver = require('./transceiver');
var makeUUID = require('../util').makeUUID;

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
function DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered) {
  if (!(this instanceof DataTrackSender)) {
    return new DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered);
  }
  var id = makeUUID();
  DataTrackTransceiver.call(this, id, maxPacketLifeTime, maxRetransmtis, ordered);
  Object.defineProperties(this, {
    _dataChannels: {
      value: new Set()
    }
  });
}

inherits(DataTrackSender, DataTrackTransceiver);

/**
 * Add an RTCDataChannel to the {@link DataTrackSender}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
DataTrackSender.prototype.addDataChannel = function addDataChannel(dataChannel) {
  this._dataChannels.add(dataChannel);
  return this;
};

/**
 * Remove an RTCDataChannel from the {@link DataTrackSender}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
DataTrackSender.prototype.removeDataChannel = function removeDataChannel(dataChannel) {
  this._dataChannels.delete(dataChannel);
  return this;
};

/**
 * Send data over the {@link DataTrackSender}. Internally, this calls
 * <code>send</code> over each of the underlying RTCDataChannels.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
 * @returns {this}
 */
DataTrackSender.prototype.send = function send(data) {
  this._dataChannels.forEach(function(dataChannel) {
    try {
      dataChannel.send(data);
    } catch (error) {
      // Do nothing.
    }
  });
  return this;
};

module.exports = DataTrackSender;
