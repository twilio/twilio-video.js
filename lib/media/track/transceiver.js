'use strict';

const TrackTransceiver = require('../../transceiver');

let instanceId = 0;

/**
 * A {@link MediaTrackTransceiver} represents either one or more local
 * RTCRtpSenders, or a single RTCRtpReceiver.
 * @extends TrackTransceiver
 * @property {MediaStreamTrack} track
 */
class MediaTrackTransceiver extends TrackTransceiver {
  /**
   * Construct a {@link MediaTrackTransceiver}.
   * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
   * @param {MediaStreamTrack} mediaStreamTrack
   */
  constructor(id, mediaStreamTrack) {
    const thisId = ++instanceId;
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
        value: mediaStreamTrack,
        writable: true,
      },
      _instanceId: {
        value: thisId
      }
    });
  }

  stop() {
    // eslint-disable-next-line no-console
    console.log(`makarand MediaTrackTransceiver[${this._instanceId}]: stop`);
    this.track.stop();
    super.stop();
  }
}

module.exports = MediaTrackTransceiver;
