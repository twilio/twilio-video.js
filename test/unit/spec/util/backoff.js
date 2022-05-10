'use strict';

const DefaultBackoff = require('../../../../lib/util/backoff');
const assert = require('assert');
const sinon = require('sinon');

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
      backoff.reset();
      fakeTimer.restore();
      fn.resetHistory();
    });

    it('should call the function on start', () => {
      backoff.start(fn);
      fakeTimer.tick(200);
      sinon.assert.calledOnce(fn);
    });

    it('should increase the duration exponentially', () => {
      backoff.start(fn);
      fakeTimer.tick(110);
      assert.strictEqual(100, backoff._duration);
      backoff.start(fn);
      fakeTimer.tick(210);
      assert.strictEqual(200, backoff._duration);
      backoff.start(fn);
      fakeTimer.tick(410);
      assert.strictEqual(400, backoff._duration);
      sinon.assert.calledThrice(fn);
    });

    it('should reset the duration', () => {
      backoff.start(fn);
      fakeTimer.tick(110);
      assert.strictEqual(100, backoff._duration);
      backoff.reset();
      assert.strictEqual(0, backoff._attempts);
      assert.strictEqual(null, backoff._timeoutID);
    });
  });

  describe('Options', () => {
    it('should take in options', () => {
      const options = {
        min: 10,
        max: 30000,
        jitter: 1,
        factor: 2
      };
      const backoff = new DefaultBackoff(options);
      const fn = sinon.spy();
      const fakeTimer = sinon.useFakeTimers();

      backoff.start(fn);
      fakeTimer.tick(20);
      sinon.assert.calledOnce(fn);
      backoff.reset();
    });
  });
});
