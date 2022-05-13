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
        testName: 'with max 400',
        options: { max: 400 },
        // 100, 200, 400, 400, 400
        // 100, 300, 700, 1100, 1500 = with max set to 400
        numberCallbackExpected: 5
      },
      {
        tickCount: 1550,
        testName: 'defaults',
        // 100, 200, 400, 800, 1600
        // 100, 300, 700, 1500  = without max
        numberCallbackExpected: 4,
        options: {  },
      }
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

        assert.equal(callbacks, testCase.numberCallbackExpected);
      });
    });

    it('factor', () => {
      const options = {
        factor: 3,
      };
      const backoff = new DefaultBackoff(options);

      backoff.backoff(fn);
      fakeTimer.tick(300);
      backoff.backoff(fn);
      fakeTimer.tick(900);
      sinon.assert.calledTwice(fn);
      backoff.reset();
    });
  });
});
