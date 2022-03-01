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
   * @param {?string} mid - The MID associated with the MediaStreamTrack
   * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
   */
  constructor(id, mid, mediaStreamTrack) {
    super(id, mid, mediaStreamTrack);
  }
}

module.exports = MediaTrackReceiver;
