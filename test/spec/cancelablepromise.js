'use strict';

var CancelablePromise = require('../../lib/util/cancelablepromise');
var assert = require('assert');
var Q = require('q');

describe('CancelablePromise', function() {
  describe('constructor', function() {
    it('should always return an instance of CancelablePromise', function() {
      var promise = Q.fcall(function(resolve, reject) { });
      var cp1 = new CancelablePromise(promise);
      var cp2 = CancelablePromise(promise);

      assert(cp1 instanceof CancelablePromise);
      assert(cp2 instanceof CancelablePromise);
    });
  });

  describe('then', function() {
    it('should execute the then of original promise', function(done) {
      var deferred1 = Q.defer();
      var deferred2 = Q.defer();

      var cancelablePromises = [
        CancelablePromise(deferred1.promise),
        CancelablePromise(deferred2.promise)
      ];

      var thens = [
        cancelablePromises[0].then(function(result) { return 'foo'; }),
        cancelablePromises[1].then(null, function(result) { return 'bar'; })
      ]

      Q.all(thens).then(function(result) {
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
      var deferred = Q.defer();
      var cp = CancelablePromise(deferred.promise);

      cp.catch(function(result) {
        assert(result === 'foo');
        done();
      });

      deferred.reject('foo');
    });
  });

  describe('cancel', function() {
    it('should cancel the promise', function(done) {
      var deferred = Q.defer();
      var cp = CancelablePromise(deferred.promise);

      cp.then(function() {
        assert.fail('Promise was not canceled');
        done();
      },function(reason) {
        assert(reason.message === 'canceled');
        done();
      });

      setTimeout(function() {
        deferred.resolve();
      }, 100);

      cp.cancel();
    });
  });
});

/*
      cancelablePromises[0].then(function(result) {
        assert(result === 'foo');
        addOne();
      }, function() {
        assert.fail('Promise1 was not resolved');
      });

      cancelablePromises[1].then(function() {
        assert.fail('Promise1 was not rejected');
      }, function(result) {
        assert(result === 'bar');
        addOne();
      });

      deferred1.resolve('foo');
      deferred2.reject('bar');
    });
  });
});*/

