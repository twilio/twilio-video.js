'use strict';

const assert = require('assert');
const sinon = require('sinon');

const IceConnectionMonitor = require('../../../../../lib/signaling/v2/iceconnectionmonitor');

describe.only('IceConnectionMonitor', () => {

  describe('constructor', () => {
    var pc;
    beforeEach( () => {
      pc = { foo: 1 };
    });

    it('stores the peerConnection provided', () => {
      assert.equal(new IceConnectionMonitor(pc)._peerConnection, pc);
    });

    it('sets the timer to null', () => {
      assert.equal(new IceConnectionMonitor(pc)._timer, null);
    });

    it('defaults to 1sec of check period', () => {
      assert.equal(new IceConnectionMonitor(pc)._activityCheckPeriodMS, 1000);
    });

    it('defaults to 3 sec of inactivity threshold', () => {
      assert.equal(new IceConnectionMonitor(pc)._inactivityThresholdMS, 3000);
    });
  });

  describe('start', () => {
    // eslint-disable-next-line no-undefined
    ['foo', 45, { foo: 5 }, null].forEach((callback) => {
      it(`throws if callback is ${typeof callback} `, () => {
        const pc = { foo: 1 };
        const monitor = new IceConnectionMonitor(pc);
        assert.throws(() => {
          monitor.start(callback);
        });
      });
    });

    it('starts the timer', () => {
      var pc = { foo: 1 };
      const monitor = new IceConnectionMonitor(pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
    });
  });


  describe('stop', () => {
    it('stops the timer', () => {
      var pc = { foo: 1 };
      const monitor = new IceConnectionMonitor(pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.stop();
      assert.equal(monitor._timer, null);
    });
  });

  describe('Callback', () => {
    it('stops the timer', () => {
      var pc = { foo: 1 };
      const monitor = new IceConnectionMonitor(pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.stop();
      assert.equal(monitor._timer, null);
    });

    it('fires when it detects inactivity in bytesReceived', (done) => {
      var pc = { foo: 1 };
      const monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMS: 1,
        inactivityThresholdMS: 3
      });

      mockMediaStats(monitor, [
        { timestamp: 1, bytesReceived: 1, bytesSent: 1 },
        { timestamp: 2, bytesReceived: 1, bytesSent: 2 },
        { timestamp: 3, bytesReceived: 1, bytesSent: 3 },
        { timestamp: 4, bytesReceived: 1, bytesSent: 4 },
        { timestamp: 5, bytesReceived: 1, bytesSent: 5 },
        { timestamp: 6, bytesReceived: 1, bytesSent: 6 },
        { timestamp: 7, bytesReceived: 1, bytesSent: 7 }
      ]);
      monitor.start(() => {
        assert.equal(monitor._getMediaStats.callCount, 4);
        monitor.stop();
        done();
      });
    });

    it('does not fire when it detects inactivity in bytesSent', (done) => {
      var pc = { foo: 1 };
      const monitor = new IceConnectionMonitor(pc, {
        activityCheckPeriodMS: 1,
        inactivityThresholdMS: 3
      });

      mockMediaStats(monitor, [
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
        assert(monitor._getMediaStats.callCount < 12, 'timeout should reach before reasonable callCount');
        done();
      }, 10);
    });

  });
});

function mockMediaStats(iceConnectionMonitor, mediaStatResults) {
  const stub = sinon.stub(iceConnectionMonitor, '_getMediaStats');
  for (var i = 0; i < mediaStatResults.length; i++) {
    stub.onCall(i).returns(Promise.resolve(mediaStatResults[i]));
  }
}
