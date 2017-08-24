'use strict';

var inherits = require('util').inherits;
var DataStreamTrack = require('./datastreamtrack');
var makeUUID = require('../util').makeUUID;

/**
 * Construct a {@link LocalDataStreamTrack}.
 * @class
 * @classdesc A {@link LocalDataStreamTrack} represents a
 *   {@link DataStreamTrack} over which data can be sent. Internally, it uses a
 *   collection of RTCDataChannels to send data.
 * @extends DataStreamTrack
 */
function LocalDataStreamTrack() {
  if (!(this instanceof LocalDataStreamTrack)) {
    return new LocalDataStreamTrack();
  }
  var id = makeUUID();
  DataStreamTrack.call(this, id);
  Object.defineProperties(this, {
    _dataChannels: {
      value: new Set()
    }
  });
}

inherits(LocalDataStreamTrack, DataStreamTrack);

/**
 * Add an RTCDataChannel to the {@link LocalDataStreamTrack}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
LocalDataStreamTrack.prototype.addDataChannel = function addDataChannel(dataChannel) {
  this._dataChannels.add(dataChannel);
  return this;
};

/**
 * Remove an RTCDataChannel from the {@link LocalDataStreamTrack}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
LocalDataStreamTrack.prototype.removeDataChannel = function removeDataChannel(dataChannel) {
  this._dataChannels.delete(dataChannel);
  return this;
};

/**
 * Send data over the {@link LocalDataStreamTrack}. Internally, this calls
 * <code>send</code> over each of the underlying RTCDataChannels.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
 * @returns {this}
 */
LocalDataStreamTrack.prototype.send = function send(data) {
  this._dataChannels.forEach(function(dataChannel) {
    try {
      dataChannel.send(data);
    } catch (error) {
      // Do nothing.
    }
  });
  return this;
};

module.exports = LocalDataStreamTrack;
