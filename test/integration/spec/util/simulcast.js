'use strict';

const assert = require('assert');
const { guessBrowser } = require('@twilio/webrtc/lib/util');
const { getMediaSections, setSimulcast } = require('../../../../es5/util/sdp');
const { RTCPeerConnection, RTCSessionDescription } = require('@twilio/webrtc');

const isChrome = guessBrowser() === 'chrome';

describe('setSimulcast', () => {
  let answer1;
  let answer2;
  let offer1;
  let offer2;
  let pc1;
  let pc2;
  let stream;
  let trackIdsToAttributes;

  if (!isChrome) {
    it('should not run the setSimulcast integration tests', () => {});
    return;
  }

  ['createOffer', 'createAnswer'].forEach(createSdp => {
    context(`#${createSdp} called when RTCPeerConnection .signalingState is "stable"`, () => {
      before(async () => {
        const constraints = { audio: true, video: true };
        stream = await makeStream(constraints);
        pc1 = new RTCPeerConnection({ iceServers: [] });
        pc1.addStream(stream);
        pc2 = new RTCPeerConnection({ iceServers: [] });
        pc2.addStream(stream);
        trackIdsToAttributes = new Map();

        const offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
        const offer = await pc1.createOffer(offerOptions);

        offer1 = createSdp === 'createOffer' ? new RTCSessionDescription({
          type: offer.type,
          sdp: setSimulcast(offer.sdp, trackIdsToAttributes)
        }) : offer;

        await pc1.setLocalDescription(offer1);
        await pc2.setRemoteDescription(offer1);
        const answer = await pc2.createAnswer();

        answer1 = createSdp === 'createAnswer' ? new RTCSessionDescription({
          type: answer.type,
          sdp: setSimulcast(answer.sdp, trackIdsToAttributes)
        }) : answer;

        await pc2.setLocalDescription(answer1);
        await pc1.setRemoteDescription(answer1);
        const _offer = await pc1.createOffer(offerOptions);

        offer2 = createSdp === 'createOffer' ? new RTCSessionDescription({
          type: _offer.type,
          sdp: setSimulcast(_offer.sdp, trackIdsToAttributes)
        }) : _offer;

        await pc2.setRemoteDescription(offer2);
        answer2 = await pc2.createAnswer();
      });

      it('should preserve simulcast SSRCs during renegotiation', () => {
        const sdp1 = createSdp === 'createOffer' ? offer1.sdp : answer1.sdp;
        const sdp2 = createSdp === 'createOffer' ? offer2.sdp : answer2.sdp;
        const ssrcAttrs1 = getMediaSections(sdp1, 'video')[0].match(/^a=ssrc:.+ (cname|msid):.+$/gm);
        const ssrcAttrs2 = getMediaSections(sdp2, 'video')[0].match(/^a=ssrc:.+ (cname|msid):.+$/gm);
        const ssrcs1 = new Set(ssrcAttrs1.map(attr => attr.match(/a=ssrc:(.+) (cname|msid):.+/)[1]));
        const ssrcs2 = new Set(ssrcAttrs2.map(attr => attr.match(/a=ssrc:(.+) (cname|msid):.+/)[1]));
        const ssrcGroupAttrs1 = sdp1.match(/^a=ssrc-group:.+$/gm);
        const ssrcGroupAttrs2 = sdp2.match(/^a=ssrc-group:.+$/gm);
        assert.deepEqual([...ssrcs1], [...ssrcs2]);
        assert.deepEqual(ssrcGroupAttrs1, ssrcGroupAttrs2);
      });

      after(() => {
        stream.getTracks().forEach(track => track.stop());
        pc1.close();
        pc2.close();
      });
    });
  });

  context('#createOffer called when RTCPeerConnection .signalingState is "have-local-offer"', () => {
    before(async () => {
      const constraints = { audio: true, video: true };
      stream = await makeStream(constraints);
      pc1 = new RTCPeerConnection({ iceServers: [] });
      pc1.addStream(stream);
      trackIdsToAttributes = new Map();

      const offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
      const offer = await pc1.createOffer(offerOptions);

      offer1 = new RTCSessionDescription({
        type: offer.type,
        sdp: setSimulcast(offer.sdp, trackIdsToAttributes)
      });

      await pc1.setLocalDescription(offer1);
      assert.equal(pc1.signalingState, 'have-local-offer');
      const _offer = await pc1.createOffer(offerOptions);

      offer2 = new RTCSessionDescription({
        type: _offer.type,
        sdp: setSimulcast(_offer.sdp, trackIdsToAttributes)
      });
    });

    it('should preserve simulcast SSRCs during renegotiation', () => {
      const sdp1 = offer1.sdp;
      const sdp2 = offer2.sdp;
      const ssrcAttrs1 = sdp1.match(/^a=ssrc:.+ (cname|msid):.+$/gm);
      const ssrcAttrs2 = sdp2.match(/^a=ssrc:.+ (cname|msid):.+$/gm);
      const ssrcGroupAttrs1 = sdp1.match(/^a=ssrc-group:.+$/gm);
      const ssrcGroupAttrs2 = sdp2.match(/^a=ssrc-group:.+$/gm);
      assert.deepEqual(ssrcAttrs1, ssrcAttrs2);
      assert.deepEqual(ssrcGroupAttrs1, ssrcGroupAttrs2);
    });

    after(() => {
      stream.getTracks().forEach(track => track.stop());
      pc1.close();
    });
  });
});

function makeStream(constraints) {
  constraints = constraints || { audio: true, fake: true, video: true };
  if (navigator.mediaDevices) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  let getUserMedia = navigator.webkitGetUserMedia;
  getUserMedia = getUserMedia || navigator.mozGetUserMedia;
  getUserMedia = getUserMedia.bind(navigator, constraints);
  return new Promise((resolve, reject) => getUserMedia(resolve, reject));
}
