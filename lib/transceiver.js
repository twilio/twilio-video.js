'use strict';

/**
 * Construct a {@link TrackTransceiver}.
 * @class
 * @classdesc A {@link TrackTransceiver} represents either one or more
 *   local RTCRtpSenders or RTCDataChannels, or a single RTCRtpReceiver
 *   or remote RTCDataChannel.
 * @param {Track.ID} id
 * @param {Track.kind} kind
 * @property {Track.ID} id
 * @property {Track.kind} kind
 */
function TrackTransceiver(id, kind) {
  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    }
  });
}

module.exports = TrackTransceiver;
