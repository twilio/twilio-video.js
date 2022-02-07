'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { defer } = require('../../../../../lib/util');
const { waitForSometime } = require('../../../../lib/util');
const IceConnectionMonitor = require('../../../../../lib/signaling/v2/iceconnectionmonitor');

const mockInactiveStats = [
  { timestamp: 1, bytesReceived: 1, bytesSent: 1 },
  { timestamp: 2, bytesReceived: 1, bytesSent: 2 },
  { timestamp: 3, bytesReceived: 1, bytesSent: 3 },
  { timestamp: 4, bytesReceived: 1, bytesSent: 4 },
  { timestamp: 5, bytesReceived: 1, bytesSent: 5 },
  { timestamp: 6, bytesReceived: 1, bytesSent: 6 },
  { timestamp: 7, bytesReceived: 1, bytesSent: 7 }
];

const mockActiveStats = [
  { timestamp: 1, bytesReceived: 1, bytesSent: 1 },
  { timestamp: 2, bytesReceived: 2, bytesSent: 1 },
  { timestamp: 3, bytesReceived: 3, bytesSent: 1 },
  { timestamp: 4, bytesReceived: 4, bytesSent: 1 },
  { timestamp: 5, bytesReceived: 5, bytesSent: 1 },
  { timestamp: 6, bytesReceived: 6, bytesSent: 1 },
  { timestamp: 7, bytesReceived: 7, bytesSent: 1 },
  { timestamp: 8, bytesReceived: 8, bytesSent: 1 },
  { timestamp: 9, bytesReceived: 9, bytesSent: 1 },
  { timestamp: 10, bytesReceived: 10, bytesSent: 1 },
  { timestamp: 11, bytesReceived: 11, bytesSent: 1 },
  { timestamp: 12, bytesReceived: 12, bytesSent: 1 },
  { timestamp: 13, bytesReceived: 13, bytesSent: 1 },
  { timestamp: 14, bytesReceived: 14, bytesSent: 1 },
  { timestamp: 15, bytesReceived: 15, bytesSent: 1 }
];

describe('IceConnectionMonitor', () => {
  let monitor = null;
  let test = null;
  beforeEach(() => {
    test = makeTest({});
  });

  afterEach(() => {
    monitor.stop();
    monitor = null;
  });

  describe('constructor', () => {
    beforeEach(() => {
      monitor = new IceConnectionMonitor(test.pc);
    });

    it('stores the peerConnection provided', () => {
      assert.equal(monitor._peerConnection, test.pc);
    });

    it('sets the timer to null', () => {
      assert.equal(monitor._timer, null);
      assert.equal(monitor._lastActivity, null);
      assert.equal(monitor._onIceConnectionStateChanged, null);
    });

    it('defaults to 1 sec of check period', () => {
      assert.equal(monitor._activityCheckPeriodMs, 1000);
    });

    it('defaults to 3 sec of inactivity threshold', () => {
      assert.equal(monitor._inactivityThresholdMs, 3000);
    });
  });

  describe('.start', () => {
    beforeEach(() => {
      monitor = new IceConnectionMonitor(test.pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });
    });

    it('starts the timer', () => {
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
    });

    context('in disconnected state', () => {
      beforeEach(() => {
        test.pc.iceConnectionState = 'disconnected';
      });

      it('fires when it detects inactivity', done => {
        test.mockIceConnectionStats(monitor, mockInactiveStats);
        monitor.start(() => {
          assert.equal(monitor._getIceConnectionStats.callCount, 4);
          monitor.stop();
          done();
        });
      });

      it('does not fire when no inactivity detected', async () => {
        test.mockIceConnectionStats(monitor, mockActiveStats);
        monitor.start(() => {
          assert.fail('inactivity callback should not have been called for bytesSent inactivity');
        });

        await waitForSometime(200);
      });
    });

    context('in connected state, ', () => {
      beforeEach(() => {
        test.iceConnectionState = 'connected';
      });

      it('on detecting inactivity registers for iceChangeEvents', async () => {
        test.mockIceConnectionStats(monitor, mockInactiveStats);

        monitor.start(() => {
          assert.fail('inactivity callback should not have been called for connected state');
        });

        await test.monitorRegisteredForConnectionChange;
      });

      it('fires inactivity callback when ice state disconnects', async () => {
        test.mockIceConnectionStats(monitor, mockInactiveStats);

        let invoked = false;
        let invokedPromise = defer();
        monitor.start(() => {
          invoked = true;
          invokedPromise.resolve();
        });

        await test.monitorRegisteredForConnectionChange;
        assert.equal(invoked, false);

        test._simulateDisconnect();
        await invokedPromise;
      });

      it('does not fire inactivity callback if activity resumes before getting disconnected', async () => {
        test.mockIceConnectionStats(monitor, mockInactiveStats);

        let invoked = false;
        monitor.start(() => {
          invoked = true;
          assert.fail('inactivity callback should not have been called for since activity was resumed');
        });

        await test.monitorRegisteredForConnectionChange;
        assert.equal(invoked, false);

        test.mockIceConnectionStats(monitor, mockActiveStats, true);

        await test.monitorUnRegisteredForConnectionChange;

        test._simulateDisconnect();

        await waitForSometime(200);

        assert.equal(invoked, false);
      });
    });
  });

  describe('._getIceConnectionStats', () => {
    it('returns null if peerConnection.getStats returns undefined', () => {
      monitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve();
        }
      });
      return monitor._getIceConnectionStats().then(iceStats => {
        assert.strictEqual(iceStats, null);
      });
    });

    it('returns null if _getIceConnectionStats rejects', () => {
      monitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.reject(new Error('boo'));
        }
      });
      return monitor._getIceConnectionStats().then(iceStats => {
        assert.strictEqual(iceStats, null);
      });
    });

    it('returns  stats even if no stats of type in-boundrtp were found', () => {
      const chromeFakeStats = new Map(Object.entries({
        'RTCIceCandidatePair_4OFKCmYa_Mi4ThK96': {
          'id': 'RTCIceCandidatePair_A',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
          'state': 'waiting',
          'priority': 395789001576824300,
          'nominated': false,
          'writable': false,
          'bytesSent': 10,
          'bytesReceived': 10,
        },
        'RTCIceCandidatePair_4OFKCmYa_Y0FHsxUI': {
          'id': 'RTCIceCandidatePair_B',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
          'state': 'in-progress',
          'priority': 9114723795305643000,
          'nominated': true,
          'writable': false,
          'bytesSent': 20,
          'bytesReceived': 20,
        }
      }));
      monitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      return monitor._getIceConnectionStats().then(activePair => {
        assert.equal(activePair.bytesReceived, 20);
        assert.equal(activePair.nominated, true);
        assert.equal(activePair.id, 'RTCIceCandidatePair_B');
      });
    });

    it('extracts active connection pair when found', () => {
      const chromeFakeStats = new Map(Object.entries({
        'RTCIceCandidatePair_4OFKCmYa_Mi4ThK96': {
          'id': 'RTCIceCandidatePair_A',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
          'state': 'waiting',
          'priority': 395789001576824300,
          'nominated': false,
          'writable': false,
          'bytesSent': 10,
          'bytesReceived': 10,
        },
        'RTCIceCandidatePair_4OFKCmYa_Y0FHsxUI': {
          'id': 'RTCIceCandidatePair_B',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
          'state': 'in-progress',
          'priority': 9114723795305643000,
          'nominated': true,
          'writable': false,
          'bytesSent': 20,
          'bytesReceived': 20,
        },
        'RTCInboundRTPAudioStream_3265672822': {
          'bytesReceived': 5845447,
          'codecId': 'RTCCodec_audio_Inbound_109',
          'fractionLost': 0,
          'id': 'RTCInboundRTPAudioStream_3265672822',
          'isRemote': false,
          'jitter': 0.004,
          'mediaType': 'audio',
          'packetsLost': 0,
          'packetsReceived': 89930,
          'ssrc': 3265672822,
          'timestamp': 1543604205208.696,
          'trackId': 'RTCMediaStreamTrack_receiver_1',
          'transportId': 'RTCTransport_audio_1',
          'type': 'inbound-rtp'
        },
      }));
      monitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      monitor._getIceConnectionStats().then(activePair => {
        assert.equal(activePair.bytesReceived, 20);
        assert.equal(activePair.nominated, true);
        assert.equal(activePair.id, 'RTCIceCandidatePair_B');
      });
    });

    it('returns fake pair with bytesReceived=0 when no active connection pair found', () => {
      const chromeFakeStats = new Map(Object.entries({
        'RTCIceCandidatePair_4OFKCmYa_Mi4ThK96': {
          'id': 'RTCIceCandidatePair_A',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
          'state': 'waiting',
          'priority': 395789001576824300,
          'nominated': false,
          'writable': false,
          'bytesSent': 10,
          'bytesReceived': 10,
        },
        'RTCIceCandidatePair_4OFKCmYa_Y0FHsxUI': {
          'id': 'RTCIceCandidatePair_B',
          'timestamp': 1543863871950.097,
          'type': 'candidate-pair',
          'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
          'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
          'state': 'in-progress',
          'priority': 9114723795305643000,
          'nominated': false,
          'writable': false,
          'bytesSent': 20,
          'bytesReceived': 20,
        },
        'RTCInboundRTPAudioStream_3265672822': {
          'bytesReceived': 5845447,
          'codecId': 'RTCCodec_audio_Inbound_109',
          'fractionLost': 0,
          'id': 'RTCInboundRTPAudioStream_3265672822',
          'isRemote': false,
          'jitter': 0.004,
          'mediaType': 'audio',
          'packetsLost': 0,
          'packetsReceived': 89930,
          'ssrc': 3265672822,
          'timestamp': 1543604205208.696,
          'trackId': 'RTCMediaStreamTrack_receiver_1',
          'transportId': 'RTCTransport_audio_1',
          'type': 'inbound-rtp'
        },
      }));

      monitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      return monitor._getIceConnectionStats().then(activePair => {
        assert.equal(activePair.bytesReceived, 0);
        assert.equal(activePair.id, undefined);
        assert.equal(typeof activePair.timestamp, 'number');
      });
    });
  });

  describe('.stop', () => {
    it('stops the timer, and resets the state', () => {
      monitor = new IceConnectionMonitor(test.pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.stop();
      assert.equal(monitor._timer, null);
      assert.equal(monitor._lastActivity, null);
      assert.equal(monitor._onIceConnectionStateChanged, null);
    });
  });
});

function makeTest(options) {
  options.listenerCallback = null;
  options.monitorRegisteredForConnectionChange = defer();
  options.monitorUnRegisteredForConnectionChange = defer();
  options.pc = {
    iceConnectionState: 'disconnected',
    addEventListener: sinon.spy((event, listener) => {
      // expect not to register multiple listeners.
      assert.equal(options.listenerCallback, null);
      assert.equal(event, 'iceconnectionstatechange');
      options.listenerCallback = listener;
      options.monitorRegisteredForConnectionChange.resolve();
    }),
    removeEventListener: sinon.spy((event, listener) => {
      assert.equal(options.listenerCallback, listener);
      assert.equal(event, 'iceconnectionstatechange');
      options.listenerCallback = null;
      options.monitorUnRegisteredForConnectionChange.resolve();
    }),
  };
  options._simulateDisconnect = () => {
    if (options.listenerCallback) {
      options.pc.iceConnectionState = 'disconnected';
      options.listenerCallback();
    }
  };

  options.mockIceConnectionStats = (iceConnectionMonitor, statResults, reattach) => {
    if (reattach) {
      iceConnectionMonitor._getIceConnectionStats.restore();
    }
    let statCallNumber = 0;
    sinon.stub(iceConnectionMonitor, '_getIceConnectionStats').callsFake(() => {
      return Promise.resolve(statResults[statCallNumber++ % statResults.length]);
    });
  };

  return options;
}
