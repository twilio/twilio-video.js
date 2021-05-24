/* eslint-disable no-console, no-undefined */
'use strict';

const assert = require('assert');
const { runPreflight } = require('../../../lib');

describe('preflight', function() {
  it('should return a preflight object', () => {
    const preflight = runPreflight();
    assert(!!preflight);
    assert(!!preflight.start);
    assert(!!preflight.stop);
    assert(!!preflight.status);
  });
});
