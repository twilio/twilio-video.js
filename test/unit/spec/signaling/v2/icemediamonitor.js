'use strict';

const assert = require('assert');

const IceMediaMonitor = require('../../../../../lib/signaling/v2/icemediamonitor');

describe.only('IceMediaMonitor', () => {

  describe('constructor', () => {
    var pc;
    beforeEach( () => {
      pc = { foo: 1 };
    });

    it('stores the pc provided', () => {
      assert.equal(new IceMediaMonitor(pc)._pc, pc);
    });

    it('sets the timer to null', () => {
      assert.equal(new IceMediaMonitor(pc)._timer, null);
    });

    it('defaults to 1sec of check period', () => {
      assert.equal(new IceMediaMonitor(pc)._activityCheckPeriodMS, 1000);
    });

    it('defaults to 3 sec of inactivity threshold', () => {
      assert.equal(new IceMediaMonitor(pc)._inactivityThresholdMS, 3000);
    });
  });

  describe('start', () => {
    // eslint-disable-next-line no-undefined
    ['foo', 45, { foo: 5 }, null].forEach((callback) => {
      it(`throws if callback is ${typeof callback} `, () => {
        const pc = { foo: 1 };
        const monitor = new IceMediaMonitor(pc);
        assert.throws(() => {
          monitor.start(callback);
        });
      });
    });

    it('starts the timer', () => {
      var pc = { foo: 1 };
      const monitor = new IceMediaMonitor(pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
    });
  });


  describe('stop', () => {
    it('stops the timer', () => {
      var pc = { foo: 1 };
      const monitor = new IceMediaMonitor(pc);
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
      const monitor = new IceMediaMonitor(pc);
      assert.equal(monitor._timer, null);
      monitor.start(() => {});
      assert.notEqual(monitor._timer, null);
      monitor.stop();
      assert.equal(monitor._timer, null);
    });
  });
});

function makeMockPC() {

}

function makeMockPromise(resolveValues) {
  // this function takes an array as input
  // and returns a promise that resolves to
  // next element in th array (starting from 0)
  let currentIndex = 0;
  return function() {
    return new Promise((resolve) =>{
      return resolve(resolveValues[currentIndex++]);
    });
  };

}
