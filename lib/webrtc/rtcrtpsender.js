'use strict';

/**
 * RTCRtpSender shim.
 * @param {MediaStreamTrack} track
 * @property {MediaStreamTrack} track
 */
function RTCRtpSenderShim(track) {
  Object.defineProperties(this, {
    track: {
      enumerable: true,
      value: track,
      writable: true
    }
  });
}

// NOTE(mmalavalli): Because of the way we will be using this shim, there
// are a couple of use cases that will not be covered:
//
// /* Case 1 */
// const sender = pc.addTrack(track);
// assert.equal(sender.track, track);
// pc.removeTrack(sender);
// assert.equal(sender.track, null); /* Error */
//
// /* Case 2 */
// const sender = pc.addTrack(track);
// const senders1 = new Set(pc.getSenders());
// assert(senders1.has(sender));
// pc.removeTrack(track);
// const senders2 = new Set(pc.getSenders());
// assert(senders2.has(sender)); /* Error */
//
// For now, since we only use senders for passing them to RTCPeerConnection#removeTrack(),
// we will omit handling these use cases for now, and revisit them when we start
// using the RTCRtpSender APIs.

module.exports = RTCRtpSenderShim;
