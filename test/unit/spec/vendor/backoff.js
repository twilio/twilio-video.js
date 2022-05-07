'use strict';

const DefaultBackoff = require('../../../../lib/vendor/backoff.js');
const assert = require('assert');
const sinon = require('sinon');

describe('Backoff', () => {
  it('should increase the backoff duration', () => {
    const backoff = new DefaultBackoff();

    assert(100 === backoff.duration());
    assert(200 === backoff.duration());
    assert(400 === backoff.duration());
    assert(800 === backoff.duration());

    backoff.reset();
    assert(100 === backoff.duration());
    assert(200 === backoff.duration());
  });

  it('should call the function once', () => {
    const backoff = new DefaultBackoff();
    const callback = sinon.spy();
    const fakeTimer = sinon.useFakeTimers();

    backoff.start(callback);
    fakeTimer.tick(200);
    sinon.assert.calledOnce(callback);
    backoff.reset();
    fakeTimer.restore();
  });
});
