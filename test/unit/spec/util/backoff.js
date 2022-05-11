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
      backoff = new DefaultBackoff(fn, options);
      fakeTimer = sinon.useFakeTimers();
    });

    afterEach(() => {
      fn.resetHistory();
      backoff.reset();
      fakeTimer.restore();
    });

    it('should call the function on start', () => {
      backoff.backoff();
      fakeTimer.tick(100);
      backoff.reset();
      sinon.assert.calledOnce(fn);
    });

    it('should increase the duration exponentially', () => {
      backoff.backoff();
      fakeTimer.tick(110);
      fakeTimer.tick(210);
      fakeTimer.tick(410);
      sinon.assert.calledThrice(fn);
    });

    it('should reset the duration', () => {
      backoff.backoff();
      fakeTimer.tick(110);
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
      const backoff = new DefaultBackoff(fn, options);

      backoff.backoff();
      fakeTimer.tick(10);
      sinon.assert.calledOnce(fn);
    });

    it('max', () => {
      const options = {
        max: 1000,
      };
      const backoff = new DefaultBackoff(fn, options);

      backoff.backoff();
      fakeTimer.tick(100);
      fakeTimer.tick(200);
      fakeTimer.tick(400);
      fakeTimer.tick(800);
      sinon.assert.callCount(fn, 4);
      backoff.reset();
      sinon.assert.callCount(fn, 4);
    });

    it('factor', () => {
      const options = {
        factor: 3,
      };
      const backoff = new DefaultBackoff(fn, options);

      backoff.backoff();
      fakeTimer.tick(300);
      fakeTimer.tick(900);
      sinon.assert.calledTwice(fn);
      backoff.reset();
    });
  });

  describe('Callback passed into backoff method', () => {
    it('should set the private member and call upon the function', () => {
      let options = {};
      const fn = sinon.spy();
      const backoff = new DefaultBackoff(null, options);
      const fakeTimer = sinon.useFakeTimers();

      backoff.backoff(fn);
      fakeTimer.tick(100);
      backoff.reset();
      sinon.assert.calledOnce(fn);
    });
  });
});
