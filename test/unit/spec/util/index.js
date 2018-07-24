'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const {
  hidePrivateProperties,
  hidePrivatePropertiesInClass,
  makeUUID,
  promiseFromEvents
} = require('../../../../lib/util');

describe('util', () => {
  describe('hidePrivateProperties', () => {
    it('should do what it says', () => {
      const object = { foo: 'bar', _baz: 'qux' };
      assert.deepEqual(Object.keys(object), ['foo', '_baz']);
      hidePrivateProperties(object);
      assert.deepEqual(Object.keys(object), ['foo']);
    });
  });

  describe('hidePrivatePropertiesInClass', () => {
    it('should do what it says', () => {
      class Foo1 {
        constructor() {
          this.args = [].slice.call(arguments);
          this._foo = 'bar';
          this._baz = 'qux';
        }
      }

      const foo1 = new Foo1(1, 2, 3);
      assert.deepEqual(Object.keys(foo1), ['args', '_foo', '_baz']);
      assert.deepEqual(foo1.args, [1, 2, 3]);

      const Foo2 = hidePrivatePropertiesInClass(Foo1);
      const foo2 = new Foo2(1, 2, 3);
      assert.deepEqual(Object.keys(foo2), ['args']);
      assert.deepEqual(foo2.args, [1, 2, 3]);
    });
  });

  describe('makeUUID', () => {
    it('should generate a unique UUID', () => {
      const uuid1 = makeUUID();
      const uuid2 = makeUUID();
      const uuid3 = makeUUID();

      assert.notEqual(uuid1, uuid2);
      assert.notEqual(uuid2, uuid3);
      assert.notEqual(uuid1, uuid3);
    });
  });

  describe('promiseFromEvents', () => {
    let emitter;
    let promise;
    let spy;

    beforeEach(() => {
      emitter = new EventEmitter();
      spy = sinon.spy();
      promise = promiseFromEvents(spy, emitter, 'foo', 'bar');
    });

    it('should call the function passed', () => {
      assert(spy.calledOnce);
    });

    it('should resolve when the success event is fired', () => {
      emitter.emit('foo');
      return promise;
    });

    it('should reject when the failure event is fired', async () => {
      emitter.emit('bar');
      try {
        await promise;
      } catch (error) {
        // Expected rejection
        return;
      }
      throw new Error('Unexpected resolution');
    });

    it('should not require a failure event', () => {
      promise = promiseFromEvents(spy, emitter, 'foo');
      emitter.emit('foo');
      return promise;
    });
  });
});
