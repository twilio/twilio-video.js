'use strict';

const DefaultBackoff = require('../../../../lib/util/backoff');
const assert = require('assert');
const sinon = require('sinon');

describe('Backoff', () => {
  it('should call the function on start', () => {
    const fn = sinon.spy();
    const backoff = new DefaultBackoff(fn);
    const fakeTimer = sinon.useFakeTimers();

    backoff.start();
    fakeTimer.tick(200);
    sinon.assert.calledOnce(fn);
    backoff.reset();
    fakeTimer.restore();
  });

  it('should increase the duration exponentially', () => {
    const fn = sinon.spy();
    const backoff = new DefaultBackoff(fn);
    const fakeTimer = sinon.useFakeTimers();

    backoff.start();
    fakeTimer.tick(110);
    assert.strictEqual(100, backoff._duration);
    backoff.start();
    fakeTimer.tick(210);
    assert.strictEqual(200, backoff._duration);
    backoff.start();
    fakeTimer.tick(410);
    assert.strictEqual(400, backoff._duration);
    sinon.assert.calledThrice(fn);
    backoff.reset();
    fakeTimer.restore();
  });

  it('should reset the duration', () => {
    const fn = sinon.spy();
    const backoff = new DefaultBackoff(fn);
    const fakeTimer = sinon.useFakeTimers();

    backoff.start();
    fakeTimer.tick(110);
    assert.strictEqual(100, backoff._duration);
    backoff.reset();
    assert.strictEqual(0, backoff._attempts);
    assert.strictEqual(null, backoff._timeoutID);
    fakeTimer.restore();
  });
});
