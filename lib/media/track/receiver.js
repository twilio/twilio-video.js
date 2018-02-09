'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @extends MediaTrackTransceiver
 */
class MediaTrackReceiver extends MediaTrackTransceiver {
  /**
   * Construct a {@link MediaTrackReceiver}.
   * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
   * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
   */
  constructor(id, mediaStreamTrack) {
    super(id, mediaStreamTrack);
  }
}

module.exports = MediaTrackReceiver;
