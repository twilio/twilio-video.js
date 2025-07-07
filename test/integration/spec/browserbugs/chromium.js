'use strict';

const { isChrome } = require('../../../lib/guessbrowser');

(isChrome ? describe : describe.skip)('Chromium bugs', () => {
  it('Bug 1127625', async () => {
    // Link: https://bugs.chromium.org/p/chromium/issues/detail?id=1127625
    const alice = new RTCPeerConnection();
    const bob = new RTCPeerConnection();
    alice.onicecandidate = e => e.candidate && bob.addIceCandidate(e.candidate);
    bob.onicecandidate = e => e.candidate && alice.addIceCandidate(e.candidate);

    // offer
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    alice.addTrack(stream.getTracks()[0], stream);
    const offer = await alice.createOffer();
    await bob.setRemoteDescription({ type: 'offer', sdp: offer.sdp.replace('m=audio 9 ', 'm=audio 0 ') });
    await alice.setLocalDescription(offer);
    const answer = await bob.createAnswer();
    await alice.setRemoteDescription(answer);
    await bob.setLocalDescription(answer);
    // console.log('done');
    const nextOffer = await bob.createOffer();
    await bob.setLocalDescription(nextOffer);
  });
});
