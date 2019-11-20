'use strict';

const assert = require('assert');
// const defaults = require('../../lib/defaults');

describe('test suites', () => {
  context('@unstable foo', () => {
    it('a sample test', () => {
      assert(true);
    });
  });
  context('@stable bar', () => {
    it('a sample test', () => {
      assert(true);
    });
  });
  it('a sample @stable test', () => {
    assert(true);
  });
  it('a sample @unstable test', () => {
    assert(true);
  });
});
