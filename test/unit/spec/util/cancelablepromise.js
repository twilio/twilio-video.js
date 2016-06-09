'use strict';

var CancelablePromise = require('../../../../lib/util/cancelablepromise');
var assert = require('assert');
var util = require('../../../../lib/util');

describe('CancelablePromise', function() {
  describe('constructor', function() {
    it('should always return an instance of CancelablePromise', function() {
      var promise = new Promise(function() {});
      var cp1 = new CancelablePromise(promise);
      var cp2 = CancelablePromise(promise);

      assert(cp1 instanceof CancelablePromise);
      assert(cp2 instanceof CancelablePromise);
    });
  });

  describe('then', function() {
    it('should execute the then of original promise', function(done) {
      var deferred1 = util.defer();
      var deferred2 = util.defer();

      var cancelablePromises = [
        CancelablePromise(deferred1.promise),
        CancelablePromise(deferred2.promise)
      ];

      var thens = [
        cancelablePromises[0].then(function(result) { return 'foo'; }),
        cancelablePromises[1].then(null, function(result) { return 'bar'; })
      ]

      Promise.all(thens).then(function(result) {
        assert(result[0] === 'foo');
        assert(result[1] === 'bar');
        done();
      });

      deferred1.resolve('foo');
      deferred2.reject('bar');
    });
  });

  describe('catch', function() {
    it('should execute the catch of original promise', function(done) {
      var deferred = util.defer();
      var cp = CancelablePromise(deferred.promise);

      cp.catch(function(result) {
        assert(result === 'foo');
        done();
      });

      deferred.reject('foo');
    });
  });

  describe('cancel', function() {
    it('should reject the promise with a "canceled" error', function(done) {
      var deferred = util.defer();
      var cp = CancelablePromise(deferred.promise);

      cp.then(function() {
        assert.fail('Promise was not canceled');
      },function(reason) {
        assert(reason.message === 'Canceled');
      }).then(done, done);

      setTimeout(function() {
        deferred.resolve();
      }, 100);

      cp.cancel();
    });
  });
});

