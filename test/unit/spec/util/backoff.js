'use strict';

const DefaultBackoff = require('../../../../lib/util/backoff');
const sinon = require('sinon');
const assert = require('assert');

describe('Backoff', () => {
  describe('Function Call', () => {
    let options = {};
    let fn;
    let backoff;
    let fakeTimer;
    beforeEach(() => {
      fn = sinon.spy();
      backoff = new DefaultBackoff(options);
      fakeTimer = sinon.useFakeTimers();
    });

    afterEach(() => {
      fn.resetHistory();
      backoff.reset();
      fakeTimer.restore();
    });

    it('should call the function on start', () => {
      backoff.backoff(fn);
      fakeTimer.tick(100);
      backoff.reset();
      sinon.assert.calledOnce(fn);
    });

    it('should increase the duration exponentially', () => {
      backoff.backoff(fn);
      fakeTimer.tick(110);
      backoff.backoff(fn);
      fakeTimer.tick(210);
      backoff.backoff(fn);
      fakeTimer.tick(410);
      sinon.assert.calledThrice(fn);
    });

    it('should reset the duration', () => {
      backoff.backoff(fn);
      fakeTimer.tick(110);
      sinon.assert.calledOnce(fn);
      backoff.reset();
      fakeTimer.tick(210);
      fakeTimer.tick(410);
      sinon.assert.calledOnce(fn);
    });
  });

  describe('Options', () => {
    let fn;
    let fakeTimer;
    beforeEach(() => {
      fn = sinon.spy();
      fakeTimer = sinon.useFakeTimers();
    });

    afterEach(() => {
      fn.resetHistory();
      fakeTimer.restore();
    });

    it('min', () => {
      const options = {
        min: 10,
      };
      const backoff = new DefaultBackoff(options);

      backoff.backoff(fn);
      fakeTimer.tick(10);
      sinon.assert.calledOnce(fn);
      backoff.reset();
    });

    [
      {
        tickCount: 1550,
        testName: 'defaults',
        // 100, 200, 400, 800, 1600
        // 100, 300, 700, 1500  = # of calls without max
        numberCallbackExpected: 4,
        options: {  },
      },
      {
        tickCount: 1550,
        testName: 'with max 400',
        options: { max: 400 },
        // 100, 200, 400, 400, 400
        // 100, 300, 700, 1100, 1500 = # of calls with max set to 400
        numberCallbackExpected: 5
      },
      {
        tickCount: 10000,
        testName: 'with min 600',
        options: { min: 600 },
        // 600, 1200, 2400, 4800, 9600
        // 600, 1800, 4200, 9000 = # of calls with min set to 600
        numberCallbackExpected: 4
      },
      {
        tickCount: 10000,
        testName: 'with factor 3',
        options: { factor: 3 },
        // 100, 300, 900, 2700, 8100
        // 100, 400, 1300, 4000 = # of calls with min set to 600
        numberCallbackExpected: 4
      },
      {
        tickCount: 25000,
        testName: 'with min 200, max 20000',
        options: { min: 200, max: 20000 },
        // 200, 400, 800, 1600, 3200, 6400, 12800
        // 200, 600, 1400, 2000, 5200, 11600  = # of calls with min set to 200 and max set to 20000
        numberCallbackExpected: 6
      },
      {
        tickCount: 25000,
        testName: 'with min 200, max 20000, factor 3',
        options: { min: 200, max: 20000, factor: 3 },
        // 200, 600, 1800, 5400, 16200, 48600
        // 200, 800, 2600, 8000, 24200  = # of calls with min set to 200 and max set to 20000, and factor set to 3
        numberCallbackExpected: 5
      },
    ].forEach(testCase => {
      it(testCase.testName, () => {
        const backoff = new DefaultBackoff(testCase.options);
        let callbacks = 0;
        function callback() {
          callbacks++;
          backoff.backoff(callback);
        }

        backoff.backoff(callback);
        fakeTimer.tick(testCase.tickCount);

        assert.strictEqual(callbacks, testCase.numberCallbackExpected);
      });
    });
  });
});
