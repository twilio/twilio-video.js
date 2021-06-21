'use strict';

const assert = require('assert');

describe('isSupported', () => {
  it('should not throw an error', () => {
    const { isSupported } = require('../../../es5/index');
  });

  it('should return false', () => {
    const { isSupported } = require('../../../es5/index');
    assert(!isSupported);
  });
});
