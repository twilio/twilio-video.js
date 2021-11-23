'use strict';

const TrackTransceiver = require('../../transceiver');

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
   * @param {?string} mid - MID associated with the {@link MediaTrackTransceiver},
   *   if it is a {@link MediaTrackReceiver}; null otherwise
   */
  constructor(id, mediaStreamTrack, mid) {
    super(id, mediaStreamTrack.kind);
    Object.defineProperties(this, {
      _track: {
        value: mediaStreamTrack,
        writable: true
      },
      enabled: {
        enumerable: true,
        get() {
          return this._track.enabled;
        }
      },
      mid: {
        enumerable: true,
        value: mid
      },
      readyState: {
        enumerable: true,
        get() {
          return this._track.readyState;
        }
      },
      track: {
        enumerable: true,
        get() {
          return this._track;
        }
      }
    });
  }

  stop() {
    this.track.stop();
    super.stop();
  }
}

module.exports = MediaTrackTransceiver;
