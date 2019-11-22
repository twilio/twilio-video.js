'use strict';

const assert = require('assert');

const isSupported = require('../../../../lib/util/support');

// placeholder ensures all variations of TEST_STABILITY end up with some tests to run.
describe('placeholder', () => {
  it('a stable test', () => {});
  it('an @unstable test', () => {});
});

describe('isBrowserSupported', () => {
  context('when called in a browser that has the getUserMedia and RTCPeerConnection APIs', () => {
    it('should return true', () => {
      assert(isSupported());
    });
  });
});
