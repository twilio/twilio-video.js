'use strict';

var assert = require('assert');
var Q = require('q');
var util = require('../../lib/util');
var iceServers = require('../../test')['iceServers'];

function test() {
  describe('util', function() {
    it('getStunServers', function() {
      assert(util.getStunServers(iceServers));
    });

    it('getTurnServers', function() {
      assert(util.getTurnServers(iceServers));
    });
  });
}

function waitAll(promisesOrDeferreds, done) {
  promisesOrDeferreds = promisesOrDeferreds.map(function(pOrD) {
    return pOrD.promise ? pOrD.promise : pOrD;
  });
  return Q.all(promisesOrDeferreds).then(function() {
    done();
  }, done);
}

module.exports.test = test;
module.exports.waitAll = waitAll;
