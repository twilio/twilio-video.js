'use strict';

var inherits = require('util').inherits;
var TrackTransceiver = require('../../transceiver');

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
function MediaTrackTransceiver(id, mediaStreamTrack) {
  TrackTransceiver.call(this, id, mediaStreamTrack.kind);
  Object.defineProperties(this, {
    readyState: {
      enumerable: true,
      get: function() {
        return mediaStreamTrack.readyState;
      }
    },
    track: {
      enumerable: true,
      value: mediaStreamTrack
    }
  });
}


inherits(MediaTrackTransceiver, TrackTransceiver);

module.exports = MediaTrackTransceiver;
