'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const { makeUUID, promiseFromEvents } = require('../../../../lib/util');

describe('util', function() {
  describe('makeUUID', function() {
    it('should generate a unique UUID', function() {
      const uuid1 = makeUUID();
      const uuid2 = makeUUID();
      const uuid3 = makeUUID();

      assert.notEqual(uuid1, uuid2);
      assert.notEqual(uuid2, uuid3);
      assert.notEqual(uuid1, uuid3);
    });
  });

  describe('promiseFromEvents', function() {
    let emitter;
    let promise;
    let spy;

    beforeEach(function() {
      emitter = new EventEmitter();
      spy = sinon.spy();
      promise = promiseFromEvents(spy, emitter, 'foo', 'bar');
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
      promise = promiseFromEvents(spy, emitter, 'foo');
      promise.then(done);
      emitter.emit('foo');
    });
  });
});
