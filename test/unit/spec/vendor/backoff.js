
var DefaultBackoff = require('../../../../lib/vendor/backoff.js');
var assert = require('assert');

describe('Backoff', function() {
  it('should increase the backoff duration', function() {
    var backoff = new DefaultBackoff();

    assert(100 === backoff.duration());
    assert(200 === backoff.duration());
    assert(400 === backoff.duration());
    assert(800 === backoff.duration());

    backoff.reset();
    assert(100 === backoff.duration());
    assert(200 === backoff.duration());
  });
});
