'use strict';

var assert = require('assert');
var constants = require('../../../../lib/util/constants');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var util = require('../../../../lib/util');


describe('util', function() {
  describe('makeUUID', function() {
    it('should generate a unique UUID', function() {
      var uuid1 = util.makeUUID();
      var uuid2 = util.makeUUID();
      var uuid3 = util.makeUUID();

      assert.notEqual(uuid1, uuid2);
      assert.notEqual(uuid2, uuid3);
      assert.notEqual(uuid1, uuid3);
    });
  });

  describe('promiseFromEvents', function() {
    var emitter;
    var promise;
    var spy;

    beforeEach(function() {
      emitter = new EventEmitter();
      spy = sinon.spy();
      promise = util.promiseFromEvents(spy, emitter, 'foo', 'bar');
    });

    it('should call the function passed', function() {
      assert(spy.calledOnce);
    });

    it('should resolve when the success event is fired', function(done) {
      promise.then(done);
      emitter.emit('foo');
    });

    it('should reject when the failure event is fired', function(done) {
      promise.catch(done);
      emitter.emit('bar');
    });

    it('should not require a failure event', function(done) {
      promise = util.promiseFromEvents(spy, emitter, 'foo');
      promise.then(done);
      emitter.emit('foo');
    });
  });
});
