'use strict';

const assert = require('assert');
const sinon = require('sinon');

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

describe('IceConnectionMonitor', () => {
  let monitor = null;
  let pc = { foo: 1 };
  beforeEach(() => {
    monitor = new IceConnectionMonitor(pc);
  });
  afterEach(() => {
    // make sure timer is stopped, and does not bother
    // other tests.
    monitor.clear();
    monitor = null;
  });
  describe('constructor', () => {
    it('stores the peerConnection provided', () => {
      assert.equal(new IceConnectionMonitor(pc)._peerConnection, pc);
    });

    it('sets the timer to null', () => {
      assert.equal(new IceConnectionMonitor(pc)._timer, null);
      assert.equal(new IceConnectionMonitor(pc)._lastActivity, null);
    });

    it('defaults to 1 sec of check period', () => {
      assert.equal(new IceConnectionMonitor(pc)._activityCheckPeriodMs, 1000);
    });

    it('defaults to 3 sec of inactivity threshold', () => {
      assert.equal(new IceConnectionMonitor(pc)._inactivityThresholdMs, 3000);
    });
  });

  describe('.start', () => {
    it('starts the timer', () => {
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
    });

    it('fires when it detects inactivity in bytesReceived', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.equal(monitor.wasInactive(), true);
        assert.equal(monitor._getIceConnectionStats.callCount, 4);
        monitor.stop();
        done();
      });
    });

    it('does not fire when it detects inactivity in bytesSent', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, [
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
      ]);
      monitor.start(() => {
        assert.fail('inactivity callback should not have been called for bytesSent inactivity');
      });

      setTimeout(() => {
        assert(monitor._getIceConnectionStats.callCount < 12, 'timeout should reach before reasonable callCount');
        done();
      }, 10);
    });
  });

  describe('._getIceConnectionStats', () => {
    it('returns null if peerConnection.getStats returns undefined', () => {
      const iceConnectionMonitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve();
        }
      });
      return iceConnectionMonitor._getIceConnectionStats().then(iceStats => {
        assert.strictEqual(iceStats, null);
      });
    });

    it('returns null if _getIceConnectionStats rejects', () => {
      const iceConnectionMonitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.reject(new Error('boo'));
        }
      });
      return iceConnectionMonitor._getIceConnectionStats().then(iceStats => {
        assert.strictEqual(iceStats, null);
      });
    });

    it('returns null if no stats of type in-boundrtp were found', () => {
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
      const iceConnectionMonitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      return iceConnectionMonitor._getIceConnectionStats().then(activePair => {
        assert.equal(activePair, null);
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
      const iceConnectionMonitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      return iceConnectionMonitor._getIceConnectionStats().then(activePair => {
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

      const iceConnectionMonitor = new IceConnectionMonitor({
        getStats: function() {
          return Promise.resolve(chromeFakeStats);
        }
      });
      return iceConnectionMonitor._getIceConnectionStats().then(activePair => {
        assert.equal(activePair.bytesReceived, 0);
        assert.equal(activePair.id, undefined);
        assert.equal(typeof activePair.timestamp, 'number');
      });
    });
  });

  describe('.stop', () => {
    it('stops the timer, and resets the state', () => {
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.stop();
      assert.equal(monitor._timer, null);
      assert.equal(monitor._lastActivity, null);
    });

    it('does not reset the wasInactive flag', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.equal(monitor.wasInactive(), true);

        monitor.stop();
        assert.equal(monitor.wasInactive(), true);
        done();
      });
    });
  });

  describe('.clear', () => {
    it('stops the timer, and resets the state', () => {
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.clear();
      assert.equal(monitor._timer, null);
      assert.equal(monitor._lastActivity, null);
    });

    it('also resets the wasInactive flag', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.equal(monitor.wasInactive(), true);
        monitor.clear();
        assert.equal(monitor.wasInactive(), false);
        done();
      });
    });
  });

  describe('.wasInactive', () => {
    it('is set to false initially', () => {
      assert.equal(monitor.wasInactive(), false);
    });

    it('is stays false if stopped before inactivity detected', () => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.fail('not expected to be reach here');
      });
      monitor.stop();
      assert.equal(monitor.wasInactive(), false);
    });

    it('is set to true after inactivity detected', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.equal(monitor.wasInactive(), true);
        monitor.stop();
        done();
      });
    });

    it('is reset to false when monitor started again', done => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, mockInactiveStats);
      monitor.start(() => {
        assert.equal(monitor.wasInactive(), true);

        monitor.start(() => {
          assert.fail('not expected to be reach here');
        });
        assert.equal(monitor.wasInactive(), false);
        monitor.stop();
        assert.equal(monitor.wasInactive(), false);
        done();
      });
    });
  });
});

function mockIceConnectionStats(iceConnectionMonitor, statResults) {
  const stub = sinon.stub(iceConnectionMonitor, '_getIceConnectionStats');
  for (var i = 0; i < statResults.length; i++) {
    stub.onCall(i).returns(Promise.resolve(statResults[i]));
  }
}
