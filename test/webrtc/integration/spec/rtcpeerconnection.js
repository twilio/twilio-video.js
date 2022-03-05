'use strict';

var assert = require('assert');
var MediaStream = require('../../../lib/mediastream');
var MediaStreamTrack = require('../../../lib/mediastreamtrack');
var RTCIceCandidate = require('../../../lib/rtcicecandidate');
var RTCSessionDescription = require('../../../lib/rtcsessiondescription');
var RTCPeerConnection = require('../../../lib/rtcpeerconnection');
var util = require('../../lib/util');
var { flatMap, guessBrowser } = require('../../../lib/util');
var { getSdpFormat } = require('../../../lib/util/sdp');

const detectSilence = require('../../lib/detectsilence');

var sdpTypes = [
  'answer',
  'offer',
  'rollback'
];

var signalingStates = [
  'closed',
  'have-local-offer',
  'have-remote-offer',
  'stable'
];

const guess = guessBrowser();
const isChrome = guess === 'chrome';
const isFirefox = guess === 'firefox';
const isSafari = guess === 'safari';
const sdpFormat = getSdpFormat();

const chromeVersion = isChrome && typeof navigator === 'object'
  ? navigator.userAgent.match(/Chrom(e|ium)\/(\d+)\./)[2]
  : null;

const firefoxVersion = isFirefox && typeof navigator === 'object'
  ? navigator.userAgent.match(/Firefox\/(\d+)\./)[1]
  : null;

describe(`RTCPeerConnection(${sdpFormat})`, function() {
  after(() => {
    if (typeof gc === 'function') {
      gc();
    }
  });

  this.timeout(30000);

  describe('constructor', () => testConstructor());

  describe('#addIceCandidate, called from signaling state', () => {
    signalingStates.forEach(signalingState => testAddIceCandidate(signalingState));
  });

  describe('#getSenders', () => {
    signalingStates.forEach(signalingState => testGetSenders(signalingState));
  });

  describe('#getReceivers', () => {
    signalingStates.forEach(signalingState => testGetReceivers(signalingState));
  });

  describe('#close, called from signaling state', () => {
    signalingStates.forEach(signalingState => testClose(signalingState));
  });

  describe('#addTrack', () => testAddTrack());

  describe('#removeTrack', () => testRemoveTrack());

  describe('#createAnswer, called from signaling state', () => {
    signalingStates.forEach(signalingState => {
      context(JSON.stringify(signalingState), () => {
        testCreateAnswer(signalingState);
      });
    });
  });

  describe('#createDataChannel', () => {
    describe('called without setting maxPacketLifeTime', () => {
      it('sets maxPacketLifeTime to null', () => {
        const pc = new RTCPeerConnection();
        const dataChannel = pc.createDataChannel('foo');
        assert.equal(dataChannel.maxPacketLifeTime, null);
      });
    });

    describe('called without setting maxRetransmits', () => {
      it('sets maxRetransmits to null', () => {
        const pc = new RTCPeerConnection();
        const dataChannel = pc.createDataChannel('foo');
        assert.equal(dataChannel.maxRetransmits, null);
      });
    });

    describe('called without setting ordered', () => {
      const pc = new RTCPeerConnection();
      const dataChannel = pc.createDataChannel('foo');
      assert.equal(dataChannel.ordered, true);
    });

    describe('called setting maxPacketLifeTime', () => {
      (isFirefox ? it.skip : it)('sets maxPacketLifeTime to the specified value', () => {
        const maxPacketLifeTime = 3;
        const pc = new RTCPeerConnection();
        const dataChannel = pc.createDataChannel('foo', { maxPacketLifeTime });
        assert.equal(dataChannel.maxPacketLifeTime, maxPacketLifeTime);
      });
    });

    describe('called setting maxRetransmits', () => {
      (isFirefox ? it.skip : it)('sets maxRetransmits to the specified value', () => {
        const maxRetransmits = 3;
        const pc = new RTCPeerConnection();
        const dataChannel = pc.createDataChannel('foo', { maxRetransmits });
        assert.equal(dataChannel.maxRetransmits, maxRetransmits);
      });
    });

    describe('called setting ordered to false', () => {
      it('sets ordered to false', () => {
        const ordered = false;
        const pc = new RTCPeerConnection();
        const dataChannel = pc.createDataChannel('foo', { ordered });
        assert.equal(dataChannel.ordered, ordered);
      });
    });

    describe('called setting both maxPacketLifeTime and maxRetransmits', () => {
      it('should throw', () => {
        const pc = new RTCPeerConnection();
        assert.throws(() => pc.createDataChannel('foo', {
          maxPacketLifeTime: 3,
          maxRetransmits: 3
        }));
      });
    });
  });

  describe('#createOffer, called from signaling state', () => {
    signalingStates.forEach(signalingState => {
      context(JSON.stringify(signalingState), () => {
        testCreateOffer(signalingState);
      });
    });
  });

  (isSafari && sdpFormat === 'planb' ? describe.skip : describe)('#createOffer, called twice from signaling state "stable" without calling #setLocalDescription', () => {
    let offer1;
    let offer2;

    before(async () => {
      const constraints = { audio: true, video: true };
      const stream = await makeStream(constraints);
      const pc = new RTCPeerConnection({ iceServers: [] });
      addStream(pc, stream);
      const options = { offerToReceiveAudio: true, offerToReceiveVideo: true };
      offer1 = await pc.createOffer(options);
      offer2 = await pc.createOffer(options);
      pc.close();
      stream.getTracks().forEach(track => track.stop());
    });

    it('does not change the SSRCs for any MediaStreamTrack in the SDP', () => {
      const ssrcAttrs1 = offer1.sdp.match(/^a=ssrc:.*$/gm);
      const ssrcAttrs2 = offer2.sdp.match(/^a=ssrc:.*$/gm);
      assert.deepEqual(ssrcAttrs2, ssrcAttrs1);
    });

    it('does not change the SSRC groups in the SDP', () => {
      const ssrcGroups1 = offer1.sdp.match(/^a=ssrc-group:.*$/gm);
      const ssrcGroups2 = offer2.sdp.match(/^a=ssrc-group:.*$/gm);
      assert.deepEqual(ssrcGroups2, ssrcGroups1);
    });
  });

  (isSafari && sdpFormat === 'planb' ? describe.skip : describe)('#createAnswer, called twice from signaling state "stable" without calling #setLocalDescription', () => {
    let answer1;
    let answer2;

    before(async () => {
      const constraints = { audio: true, video: true };
      const stream = await makeStream(constraints);
      const pc1 = new RTCPeerConnection({ iceServers: [] });
      const pc2 = new RTCPeerConnection({ iceServers: [] });
      addStream(pc2, stream);
      const options = { offerToReceiveAudio: true, offerToReceiveVideo: true };
      const offer = await pc1.createOffer(options);
      await pc2.setRemoteDescription(offer);
      answer1 = await pc2.createAnswer();
      answer2 = await pc2.createAnswer();
      pc1.close();
      pc2.close();
      stream.getTracks().forEach(track => track.stop());
    });

    it('does not change the SSRCs for any MediaStreamTrack in the SDP', () => {
      const ssrcAttrs1 = answer1.sdp.match(/^a=ssrc:.*$/gm);
      const ssrcAttrs2 = answer2.sdp.match(/^a=ssrc:.*$/gm);
      assert.deepEqual(ssrcAttrs2, ssrcAttrs1);
    });

    it('does not change the SSRC groups in the SDP', () => {
      const ssrcGroups1 = answer1.sdp.match(/^a=ssrc-group:.*$/gm);
      const ssrcGroups2 = answer2.sdp.match(/^a=ssrc-group:.*$/gm);
      assert.deepEqual(ssrcGroups2, ssrcGroups1);
    });
  });

  describe('#setLocalDescription, called from signaling state', () => {
    signalingStates.forEach(signalingState => {
      context(JSON.stringify(signalingState) + ' with a description of type', () => {
        sdpTypes.forEach(sdpType => testSetDescription(true, signalingState, sdpType));
      });
    });
  });

  describe('#setRemoteDescription, called from signaling state', () => {
    signalingStates.forEach(signalingState => {
      context(JSON.stringify(signalingState) + ' with a description of type', () => {
        sdpTypes.forEach(sdpType => testSetDescription(false, signalingState, sdpType));
      });
    });
  });

  (isSafari && sdpFormat === 'planb' ? describe.skip : describe)('#setRemoteDescription, called twice from signaling state "stable" with the same MediaStreamTrack IDs but different SSRCs', () => {
    let offer1;
    let offer2;

    beforeEach(async () => {
      const constraints = { audio: true, video: true };
      const stream = await makeStream(constraints);
      const pc = new RTCPeerConnection({ iceServers: [] });
      addStream(pc, stream);
      const options = { offerToReceiveAudio: true, offerToReceiveVideo: true };
      offer1 = await pc.createOffer(options);

      // NOTE(mmalavalli): Starting from Chrome 73, calling createOffer() without
      // setLocalDescription() on the previous offer will generate new mids for
      // RTCRtpTransceivers still under negotiation. So, in order to lock in the mids,
      // we call setLocalDescription() before calling createOffer() on the underlying
      // RTCPeerConnection.
      await pc._peerConnection.setLocalDescription(offer1);

      offer2 = await pc.createOffer(options);
      pc.close();
      stream.getTracks().forEach(track => track.stop());

      // Here is a dumb way to change SSRCs: just delete any SSRC groups, then
      // strip the leading digit from each SSRC.
      offer2 = new RTCSessionDescription({
        type: offer2.type,
        sdp: offer2.sdp.replace(/^\r\na=ssrc-group:.*$/gm, '')
          .replace(/^a=ssrc:[0-9]([0-9]+)(.*)$/gm, 'a=ssrc:$1$2')
      });
    });

    // NOTE(mroberts): This is the crux of the issue at the heart of CSDK-1206:
    //
    //   Chrome's WebRTC implementation treats changing the SSRC as removing a track
    //   with the old SSRC and adding a track with the new one. This probably isn't
    //   the right thing to do (especially when we go to Unified Plan SDP) but it's
    //   the way it's worked for a while.
    //
    (isFirefox || isSafari || (isChrome && sdpFormat === 'unified')
      ? it
      : it.skip
    )('should create a single MediaStreamTrack for each MediaStreamTrack ID in the SDP, regardless of SSRC changes', async () => {
      const getRemoteTracks = pc => sdpFormat === 'planb'
        ? flatMap(pc.getRemoteStreams(), stream => stream.getTracks())
        : flatMap(pc.getTransceivers(), ({ receiver }) => receiver.track);
      const pc = new RTCPeerConnection({ iceServers: [] });

      await pc.setRemoteDescription(offer1);
      const answer1 = await pc.createAnswer();
      await pc.setLocalDescription(answer1);
      const tracksBefore = getRemoteTracks(pc);

      await pc.setRemoteDescription(offer2);
      const answer2 = await pc.createAnswer();
      await pc.setLocalDescription(answer2);
      const tracksAfter = getRemoteTracks(pc);

      assert.equal(tracksAfter.length, tracksBefore.length);
      tracksAfter.forEach((trackAfter, i) => {
        const trackBefore = tracksBefore[i];
        assert.equal(trackAfter, trackBefore);
      });
    });
  });

  describe('DTLS role negotiation', () => testDtlsRoleNegotiation());

  describe('Glare', () => testGlare());

  describe('"datachannel" event', () => {
    describe('when maxPacketLifeTime is not set', () => {
      it('sets maxPacketLifeTime to null', async () => {
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo');
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.maxPacketLifeTime, null);
      });
    });

    describe('when maxRetransmits is not set', () => {
      it('sets maxRetransmits to null', async () => {
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo');
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.maxRetransmits, null);
      });
    });

    describe('when ordered is not set', () => {
      it('sets ordered to true', async () => {
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo');
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.ordered, true);
      });
    });

    describe('when maxPacketLifeTime is set', () => {
      (isFirefox ? it.skip : it)('sets maxPacketLifeTime to the specified value', async () => {
        const maxPacketLifeTime = 3;
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo', { maxPacketLifeTime });
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.maxPacketLifeTime, maxPacketLifeTime);
      });
    });

    describe('when maxRetransmits is set', () => {
      (isFirefox ? it.skip : it)('sets maxRetransmits to the specified value', async () => {
        const maxRetransmits = 3;
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo', { maxRetransmits });
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.maxRetransmits, maxRetransmits);
      });
    });

    describe('when ordered is set to false', () => {
      it('sets ordered to true', async () => {
        const ordered = false;
        const [offerer, answerer] = createPeerConnections();
        offerer.createDataChannel('foo', { ordered });
        const dataChannelPromise = waitForDataChannel(answerer);
        await negotiate(offerer, answerer);
        const dataChannel = await dataChannelPromise;
        assert.equal(dataChannel.ordered, ordered);
      });
    });
  });

  describe('"track" event', () => {
    context('when a new MediaStreamTrack is added', () => {
      it('should trigger a "track" event on the remote RTCPeerConnection with the added MediaStreamTrack', async () => {
        const pc1 = new RTCPeerConnection({ iceServers: [] });
        const pc2 = new RTCPeerConnection({ iceServers: [] });

        const stream = new MediaStream();

        const [localAudioTrack] = (await makeStream({ audio: true, fake: true })).getAudioTracks();
        stream.addTrack(localAudioTrack);

        pc1.addTrack(localAudioTrack, stream);
        const trackEvent1 = waitForEvent(pc2, 'track');

        const offer1 = await pc1.createOffer();
        await Promise.all([
          pc1.setLocalDescription(offer1),
          pc2.setRemoteDescription(offer1)
        ]);

        const answer1 = await pc2.createAnswer();

        const { track: remoteAudioTrack, transceiver: transceiver1 } = await trackEvent1;

        // NOTE(mroberts): This only holds pre-WebRTC 1.0; see the TrackMatcher
        // in twilio-video.js if you want behavior like this.
        if (!transceiver1 || !transceiver1.mid) {
          assert.equal(remoteAudioTrack.id, localAudioTrack.id);
        }

        await Promise.all([
          pc1.setRemoteDescription(answer1),
          pc2.setLocalDescription(answer1)
        ]);

        const [localVideoTrack] = (await makeStream({ video: true, fake: true })).getVideoTracks();
        stream.addTrack(localVideoTrack);
        pc1.addTrack(localVideoTrack, stream);
        const trackEvent2 = waitForEvent(pc2, 'track');

        const offer2 = await pc1.createOffer();
        await Promise.all([
          pc1.setLocalDescription(offer2),
          pc2.setRemoteDescription(offer2)
        ]);

        const answer2 = await pc2.createAnswer();

        const { track: remoteVideoTrack, transceiver: transceiver2 } = await trackEvent2;

        // NOTE(mroberts): This only holds pre-WebRTC 1.0; see the TrackMatcher
        // in twilio-video.js if you want behavior like this.
        if (!transceiver2 || !transceiver2.mid) {
          assert.equal(remoteVideoTrack.id, localVideoTrack.id);
        }

        await Promise.all([
          pc1.setRemoteDescription(answer2),
          pc2.setLocalDescription(answer2)
        ]);
      });
    });
  });

  // NOTE(mroberts): This integration test is ported from the JSFiddle in Bug
  // 1480277.
  (isFirefox ? describe : describe.skip)('Bug 1480277', () => {
    it('is worked around', async () => {
      const configuration = {
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'required'
      };

      const [pc1, pc2] = createPeerConnections(configuration);

      const audioContext = new AudioContext();
      const mediaStreamDestinationNode = audioContext.createMediaStreamDestination();
      const { stream: stream1 } = mediaStreamDestinationNode;
      const [track1] = stream1.getAudioTracks();
      pc1.addTrack(track1, stream1);

      const options = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      };

      await negotiate(pc1, pc2, options);

      const constraints = {
        audio: true,
        fake: true
      };

      const stream2 = await navigator.mediaDevices.getUserMedia(constraints);
      const [track2] = stream2.getAudioTracks();
      pc2.addTransceiver(track2, { streams: [stream2] });

      await negotiate(pc2, pc1, options);

      const stream3 = await navigator.mediaDevices.getUserMedia(constraints);
      const [track3] = stream3.getAudioTracks();
      const sender = pc1.addTrack(track3, stream3);

      await negotiate(pc1, pc2, options);

      const { track: remoteTrack3 } = pc2.getReceivers()[2];

      const isSilent = await detectSilence(audioContext, new MediaStream([remoteTrack3]), 10000);

      try {
        assert.equal(isSilent, false, 'remoteTrack was unexpectedly silent');
      } catch (error) {
        throw error;
      } finally {
        pc1.close();
        pc2.close();
        track1.stop();
        track2.stop();
        track3.stop();
      }
    });
  });

  if (RTCPeerConnection.prototype.addTransceiver && sdpFormat !== 'planb') {
    describe('RTCRtpTransceiver', () => {
      describe('addTransceiver(kind, init)', () => {
        const kind = 'audio';

        let pc;
        let transceiver;

        before(() => {
          pc = new RTCPeerConnection();
          transceiver = pc.addTransceiver(kind, {});
        });

        it('returns an RTCRtpTransceiver', () => {
          assert(transceiver instanceof RTCRtpTransceiver);
        });

        it('returns an RTCRtpTransceiver that is present in `getTransceivers()`', () => {
          assert(pc.getTransceivers().includes(transceiver));
        });

        it('returns an RTCRtpTransceiver whose `mid` is `null`', () => {
          assert.equal(transceiver.mid, null);
        });

        it('returns an RTCRtpTransceiver whose `sender.track` is `null`', () => {
          assert.equal(transceiver.sender.track, null);
        });

        it('returns an RTCRtpTransceiver whose `receiver.track.kind` is `kind`', () => {
          assert.equal(transceiver.receiver.track.kind, kind);
        });

        it('returns an RTCRtpTransceiver whose `stopped` is `false`', () => {
          assert(!transceiver.stopped);
        });

        it('returns an RTCRtpTransceiver whose `direction` is "sendrecv"', () => {
          assert.equal(transceiver.direction, 'sendrecv');
        });

        it('returns an RTCRtpTransceiver whose `currentDirection` is `null`', () => {
          assert.equal(transceiver.currentDirection, null);
        });
      });

      describe('addTransceiver(track, init)', () => {
        let pc;
        let track;
        let transceiver;

        before(async () => {
          pc = new RTCPeerConnection();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, fake: true });
          [track] = await stream.getAudioTracks();
          transceiver = pc.addTransceiver(track, {});
        });

        it('returns an RTCRtpTransceiver', () => {
          assert(transceiver instanceof RTCRtpTransceiver);
        });

        it('returns an RTCRtpTransceiver that is present in `getTransceivers()`', () => {
          assert(pc.getTransceivers().includes(transceiver));
        });

        it('returns an RTCRtpTransceiver whose `mid` is `null`', () => {
          assert.equal(transceiver.mid, null);
        });

        it('returns an RTCRtpTransceiver whose `sender.track` is `track`', () => {
          assert.equal(transceiver.sender.track, track);
        });

        it('returns an RTCRtpTransceiver whose `receiver.track.kind` is `track.kind`', () => {
          assert.equal(transceiver.receiver.track.kind, track.kind);
        });

        it('returns an RTCRtpTransceiver whose `stopped` is `false`', () => {
          assert(!transceiver.stopped);
        });

        it('returns an RTCRtpTransceiver whose `direction` is "sendrecv"', () => {
          assert.equal(transceiver.direction, 'sendrecv');
        });

        it('returns an RTCRtpTransceiver whose `currentDirection` is `null`', () => {
          assert.equal(transceiver.currentDirection, null);
        });
      });

      // TODO(mpatwardhan): VIDEO-4940: chrome now supports RTCRtpTransceiver.prototype.stop, but test needs to be fixed for chrome
      (RTCRtpTransceiver.prototype.stop && !isChrome ? describe : describe.skip)('Recycling Behavior', () => {
        it('Scenario 1', async () => {
          const configuration = {
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
          };

          const [pc1, pc2] = createPeerConnections(configuration);

          // Round 1
          console.log('Round 1');
          const t1 = pc1.addTransceiver('audio');
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 1);

          console.log('Round 2');
          // Round 2
          t1.stop();
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 1);

          console.log('Round 3');
          // Round 3
          const t2 = pc1.addTransceiver('audio');
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 1);
        });

        // NOTE(mmalavalli): Because of a bug where "max-bundle" does not work
        // with stopped RTCRtpTransceivers this scenario fails. So this test is
        // disabled for Safari unified plan.
        //
        // Bug: https://bugs.chromium.org/p/webrtc/issues/detail?id=9954
        //
        (isSafari && sdpFormat === 'unified' ? it.skip : it)('Scenario 2', async () => {
          const configuration = {
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
          };

          const [pc1, pc2] = createPeerConnections(configuration);

          // Round 1
          const t1 = pc1.addTransceiver('audio');
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 1);

          // Round 2
          t1.stop();
          const t2 = pc1.addTransceiver('audio');
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 2);

          // Round 3
          const t3 = pc1.addTransceiver('audio');
          await negotiate(pc1, pc2);
          assert.equal(pc1.localDescription.sdp.match(/\r\nm=/g).length, 2);
        });
      });
    });
  }
});

function assertEqualDescriptions(actual, expected) {
  if (expected === null) {
    return assert.equal(actual, expected);
  }
  assert.equal(actual.type, expected.type);
  if (expected.sdp) {
    // NOTE(mroberts): The .sdp property of a local description may change on
    // subsequent accesses (as ICE candidates are gathered); so, rather than
    // compare the entire SDP string, let us just compare the o=line.
    var expectedOLine = expected.sdp.match(/^o=.*\r$/m)[0];
    var actualOLine = actual.sdp.match(/^o=.*\r$/m)[0];
    assert.equal(actualOLine, expectedOLine);
  }
};

function emptyDescription() {
  if (isChrome && chromeVersion < 70) {
    return { type: '', sdp: '' };
  }
  return null;
}

function testConstructor() {
  var test;

  beforeEach(() => {
    return makeTest().then(_test => test = _test);
  });

  it('should return an instance of RTCPeerConnection', () => {
    assert(test.peerConnection instanceof RTCPeerConnection);
  });

  var expected = {
    iceConnectionState: 'new',
    iceGatheringState: 'new',
    localDescription: emptyDescription(),
    onaddstream: null,
    ondatachannel: null,
    onicecandidate: null,
    oniceconnectionstatechange: null,
    onnegotiationneeded: null,
    onremovestream: null,
    onsignalingstatechange: null,
    remoteDescription: emptyDescription(),
    signalingState: 'stable'
  };

  Object.keys(expected).forEach(property => {
    if (property === 'localDescription' || property === 'remoteDescription') {
      it('should set .' + property + ' to null', () => {
        assertEqualDescriptions(test.peerConnection[property], expected[property]);
      });
      return;
    }

    it('should set .' + property + ' to ' + JSON.stringify(expected[property]), () => {
      assert.equal(test.peerConnection[property], expected[property]);
    });
  });
}

function testAddIceCandidate(signalingState) {
  // NOTE(mroberts): "stable" and "have-local-offer" only trigger failure here
  // because we test one round of negotiation. If we tested multiple rounds,
  // such that remoteDescription was non-null, we would accept a success here.
  var shouldFail = {
    closed: true,
    stable: !isSafari,
    'have-local-offer': !isSafari
  }[signalingState] || false;

  var needsTransition = {
    'have-local-offer': true,
    'have-remote-offer': true
  }[signalingState] || false;

  (signalingState === 'closed' && isSafari ? context.skip : context)
  (JSON.stringify(signalingState), () => {
    var error;
    var result;
    var test;

    beforeEach(() => {
      error = null;
      result = null;

      return makeTest({
        signalingState
      }).then(_test => {
        test = _test;

        var candidate = test.createRemoteCandidate();
        var promise = test.peerConnection.addIceCandidate(candidate);

        // NOTE(mroberts): Because of the way the ChromeRTCPeerConnection
        // simulates signalingStates "have-local-offer" and "have-remote-offer",
        // addIceCandidate will block until we transition to stable.
        if (signalingState === 'have-local-offer') {
          test.createRemoteDescription('answer').then(answer => {
            return test.peerConnection.setRemoteDescription(answer);
          });
        } else if (signalingState === 'have-remote-offer') {
          test.peerConnection.createAnswer().then(answer => {
            return test.peerConnection.setLocalDescription(answer);
          });
        }

        // TODO(mroberts): Do something
        if (shouldFail) {
          return promise.catch(_error => error = _error);
        } else {
          return promise.then(_result => result = _result);
        }
      });
    });

    if (shouldFail) {
      it('should return a Promise that rejects with an error', () => {
        assert(error instanceof Error);
      });
    } else {
      it('should return a Promise that resolves to undefined', () => {
        assert.equal(result, undefined);
      });
    }
  });
}

function testGetSenders(signalingState) {
  var senders;
  var stream;
  var test;

  before(async () => {
    stream = await makeStream({ audio: true, video: true });
    test = signalingState === 'closed'
      ? await makeTest()
      : await makeTest({ signalingState });
    senders = addStream(test.peerConnection, stream);
    signalingState === 'closed' && test.peerConnection.close();
  });

  context(`"${signalingState}"`, () => {
    // NOTE(mmalavalli): Safari 12.2+ and Firefox 67+ implement the spec-compliant
    // version of RTCPeerConnection.getSenders() for signalingState "closed".
    const isSpecCompliantForClosed = signalingState === 'closed'
      && sdpFormat === 'unified'
      && (isSafari || (isFirefox && firefoxVersion > 66));

    it(`should return ${isSpecCompliantForClosed ? 'an empty list' : 'a list of senders'}`, () => {
      const actualSenders = test.peerConnection.getSenders();
      if (isFirefox && signalingState === 'have-remote-offer') {
        assert.equal(actualSenders.length, senders.length);
        return;
      } else if (isSafari && sdpFormat === 'planb' && signalingState === 'have-local-offer') {
        assert.equal(actualSenders.length, senders.length + 1);
        return;
      }
      if (isSpecCompliantForClosed) {
        assert.deepEqual(actualSenders, []);
      } else {
        assert.deepEqual(actualSenders, senders);
      }
    });
  });
}

function testGetReceivers(signalingState) {
  var pc2;
  var stream;

  before(async () => {
    const pc1 = new RTCPeerConnection({ iceServers: [] });
    pc2 = new RTCPeerConnection({ iceServers: [] });
    stream = await makeStream({ audio: true, video: true });
    addStream(pc1, stream);

    let offer = await pc1.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);
    let answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    switch(signalingState) {
      case 'closed': {
        pc2.close();
        break;
      }
      case 'have-local-offer': {
        offer = await pc2.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc2.setLocalDescription(offer);
        break;
      }
      case 'have-remote-offer': {
        offer = await pc1.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc2.setRemoteDescription(offer);
        await pc2.createAnswer();
        break;
      }
    }
  });

  context(`"${signalingState}"`, () => {
    it(`should return a list of receivers`, () => {
      pc2.getReceivers().forEach(receiver => {
        assert(receiver.track === null || receiver.track instanceof MediaStreamTrack);
      });
    });
  });
}

function expectIceConnectionStateChangeOnClose() {
  // NOTE(mpatwardhan): on newer chrome builds (80.0.3983.0+),
  //  RTCPeerConnection.close() does not fire "iceconnectionstatechange"
  //  https://bugs.chromium.org/p/chromium/issues/detail?id=1032252

  if (isChrome) {
    return chromeVersion < 80;
  } else if (isSafari) {
    return true;
  } else {
    return false;
  }
}

function expectSinglingStateChangeOnClose() {
  // NOTE(mpatwardhan): Chrome 85+ will no longer emit "signalingstatechange"
  // when RTCPeerConnection.close() is called.
  // https://bugs.chromium.org/p/chromium/issues/detail?id=699036&q=signalingstatechange&can=2

  if (isChrome) {
    return chromeVersion < 85;
  } else if (isSafari) {
    return true;
  } else {
    return false;
  }
}

function testClose(signalingState) {
  context(JSON.stringify(signalingState), () => {
    var result;
    var test;
    var signalingStateChangeInThisTick;

    beforeEach(() => {
      function onSigalingStateChanged() {
        signalingStateChangeInThisTick = true;
      }

      result = null;
      signalingStateChangeInThisTick = false;

      return makeTest({
        signalingState
      }).then(_test => {
        test = _test;

        if (signalingState === 'closed') {
          result = test.peerConnection.close();
          return;
        }

        test.peerConnection.addEventListener('signalingstatechange', onSigalingStateChanged);
        var closePromise = test.close();
        test.peerConnection.removeEventListener('signalingstatechange', onSigalingStateChanged);
        return closePromise.then(results => result = results[0]);
      });
    });

    it('should return undefined', () => {
      assert.equal(result, undefined);
    });

    var expected = {
      iceConnectionState: 'closed',
      iceGatheringState: 'complete',
      signalingState: 'closed'
    };

    Object.keys(expected).forEach(property => {
      (property === 'iceGatheringState' && isChrome
        ? it.skip
        : it
      )('should set .' + property + ' to ' + JSON.stringify(expected[property]), () => {
        assert.equal(test.peerConnection[property], expected[property]);
      });
    });

    if (signalingState === 'closed') {
      it('should not change .signalingState', () => {
        assert.equal(test.peerConnection.signalingState, signalingState);
      });

      it('should not raise a signalingstatechange event', () => {
        return test.eventIsNotRaised('signalingstatechange');
      });

    } else {
      var events = [];

      if (expectSinglingStateChangeOnClose()) {
        events.push('signalingstatechange');
      }

      if (expectIceConnectionStateChangeOnClose()) {
        events.push('iceconnectionstatechange');
      }

      events.forEach(event => {
        it('should raise ' + util.a(event) + ' ' + event + ' event', () => {
          return test.waitFor(event);
        });
      });

      it('should raise signalingstatechange event on next tick', () => {
        assert(!signalingStateChangeInThisTick);
      });
    }
  });
}

function testDtlsRoleNegotiation() {
  describe('RTCPeerConnection 1 offers with "a=setup:actpass", and', () => {
    let pc1;
    let pc2;

    beforeEach(() => {
      pc1 = new RTCPeerConnection({ iceServers: [] });
      pc2 = new RTCPeerConnection({ iceServers: [] });
      return makeStream().then(stream => {
        addStream(pc1, stream);
        addStream(pc2, stream);
        return pc1.createOffer();
      }).then(offer => {
        assert(offer.sdp.match(/a=setup:actpass/));
        return Promise.all([
          pc1.setLocalDescription(offer),
          pc2.setRemoteDescription(offer)
        ]);
      });
    });

    describe('RTCPeerConnection 2 answers with "a=setup:active"; then', () => {
      beforeEach(() => {
        return pc2.createAnswer().then(answer => {
          assert(answer.sdp.match(/a=setup:active/));
          return Promise.all([
            pc1.setRemoteDescription(answer),
            pc2.setLocalDescription(answer)
          ]);
        });
      });

      describe('RTCPeerConnection 2 offers with "a=setup:actpass", and', () => {
        beforeEach(() => {
          return pc2.createOffer().then(offer => {
            assert(offer.sdp.match(/a=setup:actpass/));
            return Promise.all([
              pc1.setRemoteDescription(offer),
              pc2.setLocalDescription(offer)
            ]);
          });
        });

        (isSafari && sdpFormat === 'planb' ? it.skip : it)('RTCPeerConnection 1 answers with "a=setup:passive"', () => {
          return pc1.createAnswer().then(answer => {
            assert(answer.sdp.match(/a=setup:passive/));
          });
        });
      });
    });
  });
}

function testGlare() {
  describe('RTCPeerConnections 1 and 2 call createOffer, and RTCPeerConnection 1 calls setLocalDescription; then', () => {
    let pc1;
    let pc2;
    let offer;

    beforeEach(() => {
      pc1 = new RTCPeerConnection({ iceServers: [] });
      pc2 = new RTCPeerConnection({ iceServers: [] });
      return makeStream().then(stream => {
        addStream(pc1, stream);
        addStream(pc2, stream);
        return Promise.all([
          pc1.createOffer(),
          pc2.createOffer()
        ]);
      }).then(offers => {
        offer = offers[1];
        return pc1.setLocalDescription(offers[0]);
      });
    });

    describe('RTCPeerConnection 1 rolls back and calls setRemoteDescription; then', () => {
      beforeEach(() => {
        return pc1.setLocalDescription(new RTCSessionDescription({ type: 'rollback' })).then(() => {
          return pc1.setRemoteDescription(offer);
        });
      });

      describe('RTCPeerConnection 1 calls createAnswer and setLocalDescription; then', () => {
        beforeEach(() => {
          return pc1.createAnswer().then(answer => {
            return pc1.setLocalDescription(answer);
          });
        });

        (isSafari && sdpFormat === 'planb' ? it.skip : it)('RTCPeerConnection 1 calls createOffer and setLocalDescription', () => {
          return pc1.createOffer().then(offer => {
            return pc1.setLocalDescription(offer);
          });
        });
      });
    });
  });
}

function waitForEvent(eventTarget, event) {
  return new Promise(resolve => {
    eventTarget.addEventListener(event, function onevent(e) {
      eventTarget.removeEventListener(event, onevent);
      resolve(e);
    });
  });
}

function makeStream(constraints) {
  constraints = constraints || { audio: true, fake: true, video: true };

  if (navigator.mediaDevices) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  var getUserMedia = navigator.webkitGetUserMedia;
  getUserMedia = getUserMedia || navigator.mozGetUserMedia;
  getUserMedia = getUserMedia.bind(navigator, constraints);
  return new Promise((resolve, reject) => getUserMedia(resolve, reject));
}

function testAddTrack() {
  var test;
  var stream;
  var tracks;
  var trackToAdd;

  before(async () => {
    stream = await makeStream();
    trackToAdd = stream.getTracks()[0];
  });

  beforeEach(async () => {
    test = await makeTest();
    tracks = getTracks(test.peerConnection);
  });

  [
    [
      'when the RTCPeerConnection is closed',
      () => test.peerConnection.close()
    ],
    [
      'when the MediaStreamTrack is already added to the RTCPeerConnection',
      () => test.peerConnection.addTrack(trackToAdd, stream)
    ]
  ].forEach(([scenario, setup]) => {
    context(scenario, () => {
      var exception;

      beforeEach(() => {
        setup();
        try {
          test.peerConnection.addTrack(trackToAdd, stream);
        } catch (e) {
          exception = e;
        }
      });

      it('should throw', () => {
        assert(exception);
      });

      it('should not change the RTCPeerConnection\'s MediaStreamTracks', () => {
        const tracksAfter = new Set(getTracks(test.peerConnection));
        assert.deepEqual(tracksAfter, tracks);
      });

      afterEach(() => {
        exception = null;
      });
    });
  });

  it('should add each of the MediaStreamTracks to the RTCPeerConnection', () => {
    const senders = addStream(test.peerConnection, stream);
    const addedTracks = getTracks(test.peerConnection);
    assert.deepEqual(addedTracks, stream.getTracks());
    assert.deepEqual(senders.map(sender => sender.track), stream.getTracks());
  });
}

function testRemoveTrack() {
  var test;
  var tracks;
  var stream;
  var localAudioSender;
  var localAudioTrack;
  var localVideoSender;

  before(async () => {
    stream = await makeStream();
    localAudioTrack = stream.getAudioTracks()[0];
  });

  beforeEach(async () => {
    test = await makeTest();
    const senders = addStream(test.peerConnection, stream);
    localAudioSender = senders.find(sender => sender.track.kind === 'audio');
    localVideoSender = senders.find(sender => sender.track.kind === 'video');
  });

  [
    [
      'when the RTCPeerConnection is closed',
      () => test.peerConnection.close(),
      true
    ],
    [
      'when the MediaStreamTrack is already removed from the RTCPeerConnection',
      () => test.peerConnection.removeTrack(localAudioSender),
      false
    ]
  ].forEach(([scenario, setup, shouldThrow]) => {
    context(scenario, () => {
      var exception;

      beforeEach(() => {
        setup();
        tracks = getTracks(test.peerConnection);
        try {
          test.peerConnection.removeTrack(localAudioSender);
        } catch (e) {
          exception = e;
        }
      });

      it(`should ${shouldThrow ? '' : 'not '}throw`, () => {
        assert(shouldThrow ? exception : !exception);
      });

      it('should not change the RTCPeerConnection\'s MediaStreamTracks', () => {
        const tracksAfter = getTracks(test.peerConnection);
        assert.deepEqual(tracksAfter, tracks);
      });

      afterEach(() => {
        exception = null;
      });
    });
  });

  (isSafari ? it.skip : it)('should remove the MediaStreamTrack from the RTCPeerConnection', () => {
    test.peerConnection.removeTrack(localAudioSender);
    const presentTracks = getTracks(test.peerConnection);
    assert.deepEqual(presentTracks, stream.getVideoTracks());
  });

  it('should remove the MediaStreamTrack from the RTCPeerConnection after calling createOffer/setLocalDescription', async () => {
    test.peerConnection.removeTrack(localAudioSender);
    const offer = await test.peerConnection.createOffer();
    await test.peerConnection.setLocalDescription(offer);

    const presentTracks = getTracks(test.peerConnection);
    assert.deepEqual(presentTracks, stream.getVideoTracks());
  });

  // NOTE(mmalavalli): Once RTCRtpSender is supported in Chrome, and we
  // actually start using the native RTCPeerConnection's addTrack()/removeTrack()
  // APIs in Firefox and Safari, these next two tests should be unskipped.
  it.skip('should set the .track on its corresponding RTCRtpSender to null', () => {
    test.peerConnection.removeTrack(localAudioSender);
    assert.equal(localAudioSender.track, null);
  });

  it.skip('should retain the same RTCRtpSender instance in the list of RTCRtpSenders maintained by the RTCPeerConnection', () => {
    test.peerConnection.removeTrack(localAudioSender);
    const senders = new Set(test.peerConnection.getSenders());
    assert(senders.has(localAudioSender));
  });
}

function testCreateAnswer(signalingState) {
  var error;
  var localDescription;
  var remoteDescription;
  var result;
  var test;

  var shouldFail = {
    closed: true,
    'have-local-offer': true,
    stable: true
  }[signalingState] || false;

  beforeEach(() => {
    error = null;
    result = null;

    return makeTest({
      signalingState
    }).then(_test => {
      test = _test;

      try {
        localDescription = test.peerConnection.localDescription;
        remoteDescription = test.peerConnection.remoteDescription;
      } catch (error) {
        // NOTE(mroberts): In Firefox, once a PeerConnection is closed,
        // attempting to access localDescription and/or remoteDescription throws
        // an Error.
      }

      var promise = test.peerConnection.createAnswer();

      if (shouldFail) {
        return promise.catch(_error => error = _error);
      } else {
        return promise.then(_result => result = _result);
      }
    });
  });

  if (shouldFail) {
    it('should return a Promise that rejects with an Error', () => {
      assert(error instanceof Error);
    });

    (isFirefox && signalingState === 'closed' ? it.skip : it)
    ('should not change .localDescription', () => {
      assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
    });

    (isFirefox && signalingState === 'closed' ? it.skip : it)
    ('should not change .remoteDescription', () => {
      assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
    });

    it('should not change .signalingState', () => {
      assert.equal(test.peerConnection.signalingState, signalingState);
    });

    it('should not raise a signalingstatechange event', () => {
      return test.eventIsNotRaised('signalingstatechange');
    });

  } else {
    it('should return a Promise that resolves to an "answer" RTCSessionDescription', () => {
      assert.equal(result.type, 'answer');
      assert(result.sdp);
    });

    it('should not change .localDescription', () => {
      assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
    });

    it('should not change .remoteDescription', () => {
      assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
    });

    it('should not change .signalingState', () => {
      assert.equal(test.peerConnection.signalingState, signalingState);
    });

    it('should not raise a signalingstatechange event', () => {
      return test.eventIsNotRaised('signalingstatechange');
    });
  }
}

function testCreateOffer(signalingState) {
  var error;
  var localDescription;
  var remoteDescription;
  var result;
  var test;

  var shouldFail = {
    'closed': true
  }[signalingState] || false;

  beforeEach(() => {
    error = null;
    result = null;

    return makeTest({
      signalingState
    }).then(_test => {
      test = _test;

      try {
        localDescription = test.peerConnection.localDescription;
        remoteDescription = test.peerConnection.remoteDescription;
      } catch (error) {
        // NOTE(mroberts): In Firefox, once a PeerConnection is closed,
        // attempting to access localDescription and/or remoteDescription throws
        // an Error.
      }

      var promise = test.peerConnection.createOffer(test.offerOptions);

      if (shouldFail) {
        return promise.catch(_error => error = _error);
      } else {
        return promise.then(_result => result = _result);
      }
    });
  });

  if (shouldFail) {
    it('should return a Promise that rejects with an Error', () => {
      assert(error instanceof Error);
    });

    (isFirefox && signalingState === 'closed' ? it.skip : it)
    ('should not change .localDescription', () => {
      assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
    });

    (isFirefox && signalingState === 'closed' ? it.skip : it)
    ('should not change .remoteDescription', () => {
      assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
    });

    it('should not change .signalingState', () => {
      assert.equal(test.peerConnection.signalingState, signalingState);
    });

    it('should not raise a signalingstatechange event', () => {
      return test.eventIsNotRaised('signalingstatechange');
    });

  } else {
    it('should return a Promise that resolves to an "offer" RTCSessionDescription', () => {
      assert.equal(result.type, 'offer');
      assert(result.sdp);
    });

    // NOTE(mroberts): The FirefoxRTCPeerConnection must rollback in order to
    // createOffer in signalingState "have-local-offer".
    (isFirefox && signalingState === 'have-local-offer' ? it.skip : it)
    ('should not change .localDescription (candidate for skip)', () => {
      assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
    });

    // NOTE(mroberts): The FirefoxRTCPeerConnection must rollback in order to
    // createOffer in signalingState "have-remote-offer".
    (isFirefox && signalingState === 'have-remote-offer' ? it.skip : it)
    ('should not change .remoteDescription (candidate for skip)', () => {
      assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
    });

    // NOTE(mroberts): The FirefoxRTCPeerConnection must rollback in order to
    // createOffer in signalingStates "have-local-offer" and "have-remote-offer".
    (isFirefox && signalingState !== 'stable' ? it.skip : it)
    ('should not change .signalingState', () => {
      assert.equal(test.peerConnection.signalingState, signalingState);
    });

    it('should not raise a signalingstatechange event', () => {
      return test.eventIsNotRaised('signalingstatechange');
    });
  }
}

function testSetDescription(local, signalingState, sdpType) {
  var createLocalDescription = local ? 'createLocalDescription' : 'createRemoteDescription';
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';

  var nextSignalingState = {
    true: {
      answer: {
        'have-remote-offer': 'stable'
      },
      offer: {
        'have-local-offer': 'have-local-offer',
        stable: 'have-local-offer'
      },
      rollback: {
        'have-local-offer': 'stable'
      }
    },
    false: {
      answer: {
        'have-local-offer': 'stable'
      },
      offer: {
        // NOTE(mmalavalli): Starting from Firefox 70, calling setRemoteDescription()
        // from .signalingState "have-local-offer" will result in an implicit rollback
        // of the local offer instead of raising an exception.
        // Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=1567951
        ...(firefoxVersion > 69 ? { 'have-local-offer': 'have-remote-offer' } : {}),
        'have-remote-offer': 'have-remote-offer',
        stable: 'have-remote-offer'
      },
      rollback: {
        'have-remote-offer': 'stable'
      }
    }
  }[local][sdpType][signalingState];

  var shouldFail = !nextSignalingState;

  context(JSON.stringify(sdpType), () => {
    var description;
    var error;
    var localDescription;
    var nextDescription;
    var remoteDescription;
    var result;
    var test;

    beforeEach(() => {
      error = null;
      result = null;

      return makeTest({
        signalingState
      }).then(_test => {
        test = _test;

        return test[createLocalDescription](sdpType);
      }).then(_description => {
        description = _description;

        try {
          localDescription = test.peerConnection.localDescription;
          remoteDescription = test.peerConnection.remoteDescription;
        } catch (error) {
          // NOTE(mroberts): In Firefox, once a PeerConnection is closed,
          // attempting to access localDescription and/or remoteDescription throws
          // an Error.
        }

        nextDescription = sdpType === 'rollback'
          ? emptyDescription()
          : description;

        var promise = test.peerConnection[setLocalDescription](description);

        if (shouldFail) {
          return promise.catch(_error => error = _error);
        } else {
          return promise.then(_result => result = _result);
        }
      });
    });

    if (shouldFail) {
      it('should return a Promise that rejects with an Error', () => {
        assert(error instanceof Error);
      });

      (isFirefox && signalingState === 'closed' ? it.skip : it)
      ('should not change .localDescription', () => {
        assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
      });

      (isFirefox && signalingState === 'closed' ? it.skip : it)
      ('should not change .remoteDescription', () => {
        assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
      });

      it('should not change .signalingState', () => {
        assert.equal(test.peerConnection.signalingState, signalingState);
      });

      it('should not raise a signalingstatechange event', () => {
        return test.eventIsNotRaised('signalingstatechange');
      });

    } else {
      it('should return a Promise that resolves to undefined', () => {
        assert.equal(result, undefined);
      });

      if (local) {
        it(sdpType === 'rollback'
            ? ('should set .localDescription to the ' + JSON.stringify(sdpType) + ' RTCSessionDescription')
            : 'should set .localDescription to the previous RTCSessionDescription', () => {
          assertEqualDescriptions(test.peerConnection.localDescription, nextDescription);
        });
      } else {
        it(`should ${firefoxVersion > 69 && sdpType === 'offer' ? 'roll back' : 'not change'} .localDescription`, () => {
          assertEqualDescriptions(test.peerConnection.localDescription, firefoxVersion > 69 && sdpType === 'offer' ? null : localDescription);
        });
      }

      if (!local) {
        it(sdpType === 'rollback'
            ? ('should set .remoteDescription to the ' + JSON.stringify(sdpType) + ' RTCSessionDescription')
            : 'should set .remoteDescription to the previous RTCSessionDescription', () => {
          assertEqualDescriptions(test.peerConnection.remoteDescription, nextDescription);
        });
      } else {
        it('should not change .remoteDescription', () => {
          assertEqualDescriptions(test.peerConnection.remoteDescription, remoteDescription);
        });
      }

      it('should set .signalingState to ' + JSON.stringify(nextSignalingState), () => {
        assert.equal(test.peerConnection.signalingState, nextSignalingState);
      });

      if (signalingState !== nextSignalingState) {
        it('should raise a signalingstatechange event', () => {
          return test.waitFor('signalingstatechange');
        });
      } else {
        it('should not raise a signalingstatechange event', () => {
          return test.eventIsNotRaised('signalingstatechange');
        });
      }
    }
  });
}

function makeTest(options) {
  var dummyOfferSdp = `v=0\r
o=- 2018425083800689377 2 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE ${isFirefox && firefoxVersion < 63
    ? 'sdparta_0'
    : sdpFormat === 'unified'
      ? '0' : 'audio'}\r
a=msid-semantic: WMS\r
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:hml5\r
a=ice-pwd:VSJteFVvAyoewWkSfaxKgU6C\r
a=ice-options:trickle\r
a=mid:${isFirefox && firefoxVersion < 63
    ? 'sdparta_0'
    : sdpFormat === 'unified'
      ? '0' : 'audio'}\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=recvonly\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
a=fingerprint:sha-256 0F:F6:1E:6F:88:AC:BA:0F:D1:4D:D7:0C:E2:B7:8E:93:CA:75:C8:8A:A4:59:E4:66:22:3D:B7:4E:9E:E1:AB:E4\r
`;

  var dummyAnswerSdp = dummyOfferSdp.replace(/a=recvonly/mg, 'a=inactive');

  if (isFirefox) {
    dummyOfferSdp += 'a=setup:actpass\r\n';
    dummyAnswerSdp.replace(/a=setup:actpass\r/mg, '');
  }

  var test = Object.assign({
    dummyAnswerSdp: dummyAnswerSdp,
    dummyOfferSdp: dummyOfferSdp,
    events: new Map(),
    iceServers: [],
    localAnswers: [],
    localOffers: [],
    offerOptions: { offerToReceiveAudio: true },
    peerConnection: null,
    remoteAnswer: function remoteAnswer() {
      return new RTCSessionDescription({
        type: 'answer',
        sdp: test.dummyAnswerSdp
      });
    },
    remoteOffer: function remoteOffer() {
      return new RTCSessionDescription({
        type: 'offer',
        sdp: test.dummyOfferSdp
      });
    },
    signalingState: 'stable'
  }, options);

  if (!test.peerConnection) {
    test.peerConnection = new RTCPeerConnection(test);
  }

  test.close = function close() {
    const promisesToWaitFor = [test.peerConnection.close()];

    if (expectSinglingStateChangeOnClose()) {
      promisesToWaitFor.push(test.waitFor('signalingstatechange'));
    }

    if (expectIceConnectionStateChangeOnClose()) {
      promisesToWaitFor.push(test.waitFor('iceconnectionstatechange'));
    }

    return Promise.all(promisesToWaitFor);
  };

  test.createLocalDescription = function createLocalDesription(sdpType) {
    var promise;
    switch (sdpType) {
      case 'answer':
        switch (test.peerConnection.signalingState) {
          case 'have-remote-offer':
            promise = test.peerConnection.createAnswer().then(answer => {
              test.localAnswers.push(answer);
              test.resetEvents();
              return answer;
            });
            break;
          default:
            promise = Promise.resolve(new RTCSessionDescription({
              type: 'answer',
              sdp: dummyAnswerSdp
            }));
            break;
        }
        break;
      case 'offer':
        switch (test.peerConnection.signalingState) {
          case 'have-local-offer':
          case 'stable':
            promise = test.peerConnection.createOffer(test.offerOptions).then(offer => {
              test.localOffers.push(offer);
              test.resetEvents();
              return offer;
            });
            break;
          default:
            promise = Promise.resolve(new RTCSessionDescription({
              type: 'offer',
              sdp: dummyOfferSdp
            }));
            break;
        }
        break;
      case 'rollback':
        promise = Promise.resolve(new RTCSessionDescription({
          type: 'rollback'
        }));
        break;
    }
    return promise.then(description => {
      test.resetEvents();
      return description;
    });
  };

  test.createRemoteDescription = function createRemoteDesription(sdpType) {
    var description;
    switch (sdpType) {
      case 'answer':
        description = new RTCSessionDescription({
          type: 'answer',
          sdp: dummyAnswerSdp
        });
        break;
      case 'offer':
        description = new RTCSessionDescription({
          type: 'offer',
          sdp: dummyOfferSdp
        });
        break;
      case 'rollback':
        description = new RTCSessionDescription({
          type: 'rollback'
        });
        break;
    }
    return Promise.resolve(description);
  };

  test.createRemoteCandidate = function createRemoteCandidate() {
    return new RTCIceCandidate({
      candidate: 'candidate:750991856 2 udp 25108222 237.30.30.30 51472 typ relay raddr 47.61.61.61 rport 54763 generation 0',
      sdpMLineIndex: 0
    });
  };

  var events = [
    'iceconnectionstatechange',
    'signalingstatechange'
  ];

  events.forEach(event => {
    if (!test.events.has(event)) {
      test.events.set(event, []);
    }
    var events = test.events.get(event);
    test.peerConnection.addEventListener(event, event => events.push(event));
  });

  test.resetEvent = function resetEvent(event) {
    test.events.get(event).splice(0);
  };

  test.resetEvents = function resetEvents() {
    events.forEach(test.resetEvent);
  };

  test.waitFor = async function waitFor(event) {
    const timeoutMS = 10 * 1000;
    var events = test.events.get(event);
    if (events.length) {
      return Promise.resolve(events[0]);
    }
    const eventPromise = new Promise(resolve => {
      test.peerConnection.addEventListener(event, resolve);
    });

    let timer = null;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        // eslint-disable-next-line no-console
        reject(new Error(`Timed out waiting for ${event} to fire`));
      }, timeoutMS);
    });
    const result = await Promise.race([eventPromise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  };

  test.eventIsNotRaised = function eventIsNotRaised(event) {
    return new Promise((resolve, reject) => {
      // NOTE(mroberts): This methods ensures that the event is not raised in
      // the previous tick using setTimeout. This should be sufficient to
      // ensure that events like signalingstatechange are not raised in
      // response to one of our API calls.
      setTimeout(() => {
        var events = test.events.get(event);
        if (events.length) {
          return reject(new Error('Event was raised'));
        }
        resolve();
      });
    });
  };

  var setup;
  switch (test.signalingState) {
    case 'closed':
      setup = test.close().then(() => test.resetEvents());
      break;
    case 'stable':
      setup = Promise.resolve(test);
      break;
    case 'have-local-offer':
      setup = test.peerConnection.createOffer(test.offerOptions).then(offer => {
        test.localOffers.push(offer);
        return Promise.all([
          test.peerConnection.setLocalDescription(offer),
          test.waitFor('signalingstatechange')
        ]);
      }).then(test.resetEvents);
      break;
    case 'have-remote-offer':
      setup = Promise.all([
        test.peerConnection.setRemoteDescription(test.remoteOffer()),
        test.waitFor('signalingstatechange')
      ]).then(test.resetEvents)
      break;
    default:
      setup = Promise.reject(
        new Error('Unknown signaling state "' + test.signalingState + '"'));
      break;
  }

  return setup.then(() => test);
}

function addStream(peerConnection, stream) {
  return stream.getTracks().map(track => peerConnection.addTrack(track, stream));
}

function getTracks(peerConnection) {
  return peerConnection.getSenders().filter(sender => sender.track).map(sender => sender.track);
}

function createPeerConnections(configuration) {
  const pc1 = new RTCPeerConnection(configuration);
  const pc2 = new RTCPeerConnection(configuration);
  [[pc1, pc2], [pc1, pc2]].forEach(([pc1, pc2]) => {
    pc1.addEventListener('icecandidate', event => {
      if (event.candidate) {
        pc2.addIceCandidate(event.candidate);
      }
    });
  });
  return [pc1, pc2];
}

function waitForDataChannel(pc) {
  return new Promise(resolve =>
    pc.addEventListener('datachannel', event => resolve(event.channel)));
}

async function negotiate(offerer, answerer, options) {
  const offer = await offerer.createOffer(options);
  await Promise.all([
    offerer.setLocalDescription(offer),
    answerer.setRemoteDescription(offer)
  ]);
  const answer = await answerer.createAnswer();
  await Promise.all([
    answerer.setLocalDescription(answer),
    offerer.setRemoteDescription(answer)
  ]);
}
