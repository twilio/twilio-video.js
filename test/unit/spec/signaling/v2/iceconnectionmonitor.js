'use strict';

const assert = require('assert');
const sinon = require('sinon');

const IceConnectionMonitor = require('../../../../../lib/signaling/v2/iceconnectionmonitor');

describe('IceConnectionMonitor', () => {
  let monitor = null;
  let pc = { foo: 1 };
  beforeEach(() => {
    monitor = new IceConnectionMonitor(pc);
  });
  afterEach(() => {
    // make sure timer is stopped, and does not bother
    // other tests.
    monitor.stop();
  });

  describe('.constructor', () => {
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

    it('fires when it detects inactivity in bytesReceived', (done) => {
      monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMs: 1,
        inactivityThresholdMs: 3
      });

      mockIceConnectionStats(monitor, [
        { timestamp: 1, bytesReceived: 1, bytesSent: 1 },
        { timestamp: 2, bytesReceived: 1, bytesSent: 2 },
        { timestamp: 3, bytesReceived: 1, bytesSent: 3 },
        { timestamp: 4, bytesReceived: 1, bytesSent: 4 },
        { timestamp: 5, bytesReceived: 1, bytesSent: 5 },
        { timestamp: 6, bytesReceived: 1, bytesSent: 6 },
        { timestamp: 7, bytesReceived: 1, bytesSent: 7 }
      ]);
      monitor.start(() => {
        assert.equal(monitor._getStats.callCount, 4);
        monitor.stop();
        done();
      });
    });

    it('does not fire when it detects inactivity in bytesSent', (done) => {
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
        assert(monitor._getStats.callCount < 12, 'timeout should reach before reasonable callCount');
        done();
      }, 10);
    });

  });

  describe('._getStats', () => {
    it('extracts limited stats from _getIceConnectionStats', () => {
      const iceConnectionMonitor = new IceConnectionMonitor(pc);
      sinon.stub(iceConnectionMonitor, '_getIceConnectionStats').returns(Promise.resolve({
        timestamp: 10,
        otherProp: 20,
        bytesSent: 30,
        bytesReceived: 40
      }));
      return iceConnectionMonitor._getStats().then((iceStats) => {
        assert.deepStrictEqual(iceStats, {
          timestamp: 10,
          bytesSent: 30,
          bytesReceived: 40
        });
      });
    });

    it('returns null if _getIceConnectionStats returns undefined', () => {
      const iceConnectionMonitor = new IceConnectionMonitor(pc);
      // eslint-disable-next-line no-undefined
      sinon.stub(iceConnectionMonitor, '_getIceConnectionStats').returns(Promise.resolve(undefined));
      return iceConnectionMonitor._getStats().then((iceStats) => {
        assert.strictEqual(iceStats, null);
      });
    });

    it('returns null if _getIceConnectionStats rejects', () => {
      const iceConnectionMonitor = new IceConnectionMonitor(pc);
      sinon.stub(iceConnectionMonitor, '_getIceConnectionStats').returns(Promise.reject(new Error('boo')));
      return iceConnectionMonitor._getStats().then((iceStats) => {
        assert.strictEqual(iceStats, null);
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
  });
});

function mockIceConnectionStats(iceConnectionMonitor, statResults) {
  const stub = sinon.stub(iceConnectionMonitor, '_getStats');
  for (var i = 0; i < statResults.length; i++) {
    stub.onCall(i).returns(Promise.resolve(statResults[i]));
  }
}
