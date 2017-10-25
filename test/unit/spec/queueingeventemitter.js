'use strict';

const assert = require('assert');

const QueueingEventEmitter = require('../../../lib/queueingeventemitter');

describe('QueueingEventEmitter', () => {
  let ee;

  beforeEach(() => {
    ee = new QueueingEventEmitter();
  });

  describe('#queue', () => {
    it('should return true when a listener is present', () => {
      ee.on('event', () => {});
      assert(ee.queue('event', 'foo'));
    });

    it('should emit an event immediately when a listener is present', () => {
      const values = [];
      ee.on('event', value => values.push(value));

      ee.queue('event', 'foo');

      assert.equal(1, values.length);
      assert.equal('foo', values[0]);
    });

    it('should return false if no listener is present', () => {
      assert(!ee.queue('event', 'foo'));
    });

    it('should queue events if no listener is present until #dequeue is called', () => {
      ee.queue('event', 'foo');
      ee.queue('event', 'bar');

      const values = [];
      ee.on('event', value => values.push(value));

      ee.dequeue();
      assert.equal('foo', values[0]);
      assert.equal('bar', values[1]);
    });
  });

  describe('#dequeue()', () => {
    it('should return true if there are no queued events', () => {
      assert(ee.dequeue());
    });

    it('should return true if every queued event has a listener', () => {
      ee.queue('foo', 'bar');
      ee.queue('baz', 'qux');
      ee.on('foo', () => {});
      ee.on('baz', () => {});
      assert(ee.dequeue());
    });

    it('should return false if any queued event has no listener', () => {
      ee.queue('foo', 'bar');
      ee.queue('baz', 'qux');
      ee.on('foo', () => {});
      assert(!ee.dequeue());

      ee.queue('baz', 'qux');
      ee.queue('baz', 'quux');
      ee.once('baz', () => {});
      assert(!ee.dequeue());
    });
  });

  describe('#dequeue(event)', () => {
    it('should return true if there are no queued events', () => {
      assert(ee.dequeue());
    });

    it('should return true if every queued event has a listener', () => {
      ee.queue('foo', 'bar');
      ee.queue('foo', 'baz');
      ee.on('foo', () => {});
      assert(ee.dequeue('foo'));
    });

    it('should return false if any queued event has no listener', () => {
      ee.queue('foo', 'bar');
      ee.queue('foo', 'baz');
      ee.once('foo', () => {});
      assert(!ee.dequeue('foo'));
    });
  });
});
