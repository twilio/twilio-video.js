'use strict';

const assert = require('assert');

const isSupported = require('../../../../es5/util/support');

describe('isBrowserSupported', () => {
  context('when called in a browser that has the getUserMedia and RTCPeerConnection APIs', () => {
    it('should return true', () => {
      assert(isSupported());
    });
  });
});
