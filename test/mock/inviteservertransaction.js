'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');
var sinon = require('sinon');
var util = require('lib/util');

function MockIST() {
  EventEmitter.call(this);

  function createPromise() {
    var deferred = Q.defer();

    var spy = new sinon.spy(function() {
      return deferred.promise;
    });

    spy.resolve = deferred.resolve.bind(deferred);
    spy.reject = deferred.resolve.bind(deferred);

    return spy;
  }

  Object.defineProperties(this, {
    accept: {
      value: createPromise()
    },
    from: {
      value: util.makeURI('AC123', 'foo')
    },
    reject: {
      value: createPromise()
    }
  });
};

inherits(MockIST, EventEmitter);

module.exports = MockIST;
