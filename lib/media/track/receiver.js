'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackReceiver}.
 * @class
 * @classdesc A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
 * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
 */
class MediaTrackReceiver extends MediaTrackTransceiver {
  constructor(id, mediaStreamTrack) {
    super(id, mediaStreamTrack);
  }
}

module.exports = MediaTrackReceiver;
