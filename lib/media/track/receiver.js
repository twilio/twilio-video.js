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
   * @param {string} mid - The MID associated with the {@link MediaTrackReceiver}.
   */
  constructor(id, mediaStreamTrack, mid) {
    super(id, mediaStreamTrack, mid);
  }
}

module.exports = MediaTrackReceiver;
