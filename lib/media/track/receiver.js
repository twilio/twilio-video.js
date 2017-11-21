'use strict';

var inherits = require('util').inherits;
var MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackReceiver}.
 * @class
 * @classdesc A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
 * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
 */
function MediaTrackReceiver(id, mediaStreamTrack) {
  if (!(this instanceof MediaTrackReceiver)) {
    return new MediaTrackReceiver(id, mediaStreamTrack);
  }
  MediaTrackTransceiver.call(this, id, mediaStreamTrack);
}

inherits(MediaTrackReceiver, MediaTrackTransceiver);

module.exports = MediaTrackReceiver;
