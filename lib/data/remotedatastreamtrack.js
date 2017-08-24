'use strict';

var inherits = require('util').inherits;
var DataStreamTrack = require('./datastreamtrack');

/**
 * Construct an {@link RemoteDataStreamTrack}.
 * @class
 * @classdesc A {@link RemoteDataStreamTrack} represents a
 *   {@link DataStreamTrack} over which data can be received. Internally, it
 *   users a single RTCDataChannel to receive data.
 * @extends DataStreamTrack
 * @param {RTCDataChannel} dataChannel
 * @fires RemoteDataStreamTrack#message
 */
function RemoteDataStreamTrack(dataChannel) {
  if (!(this instanceof RemoteDataStreamTrack)) {
    return new RemoteDataStreamTrack(dataChannel);
  }
  DataStreamTrack.call(this, dataChannel.label);
  var self = this;
  dataChannel.addEventListener('message', function(event) {
    self.emit('message', event.data);
  });
}

inherits(RemoteDataStreamTrack, DataStreamTrack);

/**
 * @event RemoteDataStreamTrack#message
 * @param {string|ArrayBuffer} data
 */

module.exports = RemoteDataStreamTrack;
