'use strict';

const TrackTransceiver = require('../../transceiver');

/**
 * Construct a {@link MediaTrackTransceiver}.
 * @class
 * @classdesc A {@link MediaTrackTransceiver} represents either one or more
 *   local RTCRtpSenders, or a single RTCRtpReceiver.
 * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {MediaStreamTrack} track
 * @extends TrackTransceiver
 */
class MediaTrackTransceiver extends TrackTransceiver {
  constructor(id, mediaStreamTrack) {
    super(id, mediaStreamTrack.kind);
    Object.defineProperties(this, {
      readyState: {
        enumerable: true,
        get() {
          return mediaStreamTrack.readyState;
        }
      },
      track: {
        enumerable: true,
        value: mediaStreamTrack
      }
    });
  }
}

module.exports = MediaTrackTransceiver;
