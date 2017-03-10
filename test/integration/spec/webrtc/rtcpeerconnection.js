'use strict';

var assert = require('assert');
var MediaStream = require('../../../../lib/webrtc/mediastream');
var RTCIceCandidate = require('../../../../lib/webrtc/rtcicecandidate');
var RTCSessionDescription = require('../../../../lib/webrtc/rtcsessiondescription');
var RTCPeerConnection = require('../../../../lib/webrtc/rtcpeerconnection');
var util = require('../../../lib/util');

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

var isFirefox = typeof mozRTCPeerConnection !== 'undefined';

describe('RTCPeerConnection', function() {
  this.timeout(30000);

  describe('constructor', testConstructor);

  describe('#addIceCandidate, called from signaling state', () => {
    signalingStates.forEach(testAddIceCandidate);
  });

  describe('#getRemoteStreams, called from signaling state', () => {
    signalingStates.forEach(testGetRemoteStreams);
  });

  describe('#close, called from signaling state', () => {
    signalingStates.forEach(testClose);
  });

  describe('#addStream', testAddStream);

  describe('#createAnswer, called from signaling state', () => {
    signalingStates.forEach(signalingState => {
      context(JSON.stringify(signalingState), () => {
        testCreateAnswer(signalingState);
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

  describe('DTLS role negotiation', () => {
    testDtlsRoleNegotiation();
  });

  describe('Glare', () => {
    testGlare();
  });

  describe('"track" event', () => {
    context('when a new MediaStreamTrack is added', () => {
      it('should trigger a "track" event on the remote RTCPeerConnection with the added MediaStreamTrack', () => {
        var audioTrack;
        var videoTrack;
        var theMediaStream = new MediaStream();
        var pc1 = new RTCPeerConnection({ iceServers: [] });
        var pc2 = new RTCPeerConnection({ iceServers: [] });

        return makeStream({ audio: true, fake: true }).then(mediaStream => {
          audioTrack = mediaStream.getAudioTracks()[0];
          theMediaStream.addTrack(audioTrack);
          pc1.addStream(theMediaStream);
          return pc1.createOffer();
        }).then(offer => {
          return Promise.all([
            pc1.setLocalDescription(offer),
            pc2.setRemoteDescription(offer).then(() => pc2.createAnswer()),
            waitForEvent(pc2, 'track').then(e => assert.equal(e.track.id, audioTrack.id))
          ]);
        }).then(results => {
          var answer = results[1];
          return Promise.all([
            pc1.setRemoteDescription(answer),
            pc2.setLocalDescription(answer)
          ]);
        }).then(() => {
          return makeStream({ video: true, fake: true });
        }).then(mediaStream => {
          videoTrack = mediaStream.getVideoTracks()[0];
          pc1.removeStream(theMediaStream);
          theMediaStream.addTrack(videoTrack);
          pc1.addStream(theMediaStream);
          return pc1.createOffer();
        }).then(offer => {
          return Promise.all([
            pc1.setLocalDescription(offer),
            pc2.setRemoteDescription(offer).then(() => pc2.createAnswer()),
            waitForEvent(pc2, 'track').then(e => assert.equal(e.track.id, videoTrack.id))
          ]);
        }).then(results => {
          var answer = results[1];
          return Promise.all([
            pc1.setRemoteDescription(answer),
            pc2.setLocalDescription(answer)
          ]);
        });
      });
    });
  });
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
  if (typeof webkitRTCPeerConnection !== 'undefined') {
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
    stable: true,
    'have-local-offer': true
  }[signalingState] || false;

  var needsTransition = {
    'have-local-offer': true,
    'have-remote-offer': true
  }[signalingState] || false;

  context(JSON.stringify(signalingState), () => {
    var error;
    var result;
    var test;

    beforeEach(() => {
      error = null;
      result = null;

      return makeTest({
        signalingState: signalingState
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
      it('should return a Promise that resolves to undefiend', () => {
        assert.equal(result, undefined);
      });
    }
  });
}

function testGetRemoteStreams(signalingState) {
  context(JSON.stringify(signalingState), () => {
    var test;

    beforeEach(() => {
      return makeTest({ signalingState: signalingState })
        .then(_test => test = _test);
    });

    if (signalingState === 'closed') {
      it('should return an empty array', () => {
        assert.deepEqual(test.peerConnection.getRemoteStreams(), []);
      });
    }
    else {
      it('should return the result of calling getRemoteStreams() on the underlying RTCPeerConnection', () => {
        assert.deepEqual(test.peerConnection.getRemoteStreams(), test.peerConnection._peerConnection.getRemoteStreams());
      });
    }
  });
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
        signalingState: signalingState
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
      it('should set .' + property + ' to ' + JSON.stringify(expected[property]), () => {
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
      var events = [
        'iceconnectionstatechange',
        'signalingstatechange'
      ];

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
        pc1.addStream(stream);
        pc2.addStream(stream);
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

        it('RTCPeerConnection 1 answers with "a=setup:passive"', () => {
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
        pc1.addStream(stream);
        pc2.addStream(stream);
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

        it('RTCPeerConnection 1 calls createOffer and setLocalDescription', () => {
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

function testAddStream() {
  var test;
  var stream;

  before(() => {
    return makeStream().then(_stream => stream = _stream);
  });

  beforeEach(() => {
    return makeTest().then(_test => test = _test);
  });

  it('should add a stream to the RTCPeerConnection', () => {
    test.peerConnection.addStream(stream);
    assert.equal(test.peerConnection.getLocalStreams()[0], stream);
  });

  context('when adding a stream that is already added', () => {
    it('should not throw an exception', () => {
      test.peerConnection.addStream(stream);
      assert.doesNotThrow(() => test.peerConnection.addStream(stream));
    });

    it('should not add the stream', () => {
      test.peerConnection.addStream(stream);
      test.peerConnection.addStream(stream);
      assert.equal(test.peerConnection.getLocalStreams().length, 1);
    });
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
      signalingState: signalingState
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
      signalingState: signalingState
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
        signalingState: signalingState
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
        it('should not change .localDescription', () => {
          assertEqualDescriptions(test.peerConnection.localDescription, localDescription);
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
o=- 6666666666666666666 6 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=msid-semantic: WMS\r
m=audio 0 UDP/TLS/RTP/SAVPF 111\r
a=recvonly\r
c=IN IP4 127.0.0.1\r
`;

  var dummyAnswerSdp = dummyOfferSdp
    .replace(/a=recvonly/mg, 'a=inactive')
    .replace(/6/mg, '7');

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
    return Promise.all([
      test.peerConnection.close(),
      test.waitFor('signalingstatechange'),
      test.waitFor('iceconnectionstatechange')
    ]);
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

  test.waitFor = function waitFor(event) {
    var events = test.events.get(event);
    if (events.length) {
      return Promise.resolve(events[0]);
    }
    return new Promise(resolve => {
      test.peerConnection.addEventListener(event, resolve);
    });
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
      setup = test.close().then(test.resetEvents);
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
