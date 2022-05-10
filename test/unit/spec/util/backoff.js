'use strict';

const DefaultBackoff = require('../../../../lib/util/backoff');
const assert = require('assert');
const sinon = require('sinon');

describe('Backoff', () => {
  it('should increase the backoff duration', () => {
    const fn = sinon.spy();
    const backoff = new DefaultBackoff(fn);
    const fakeTimer = sinon.useFakeTimers();

    backoff.start();
    fakeTimer.tick(200);
    sinon.assert.calledOnce(fn);
    backoff.reset();
    fakeTimer.restore();
  });
});
