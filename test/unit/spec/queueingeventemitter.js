'use strict';

const assert = require('assert');

const QueueingEventEmitter = require('../../../lib/queueingeventemitter');

describe('QueueingEventEmitter', function() {
  let ee;

  beforeEach(function() {
    ee = new QueueingEventEmitter();
  });

  describe('#queue', function() {
    it('should return true when a listener is present', function() {
      ee.on('event', function() {});
      assert(ee.queue('event', 'foo'));
    });

    it('should emit an event immediately when a listener is present', function() {
      const values = [];
      ee.on('event', function(value) {
        values.push(value);
      });

      ee.queue('event', 'foo');

      assert.equal(1, values.length);
      assert.equal('foo', values[0]);
    });

    it('should return false if no listener is present', function() {
      assert(!ee.queue('event', 'foo'));
    });

    it('should queue events if no listener is present until #dequeue is called', function() {
      ee.queue('event', 'foo');
      ee.queue('event', 'bar');

      const values = [];
      ee.on('event', function(value) {
        values.push(value);
      });

      ee.dequeue();
      assert.equal('foo', values[0]);
      assert.equal('bar', values[1]);
    });
  });

  describe('#dequeue()', function() {
    it('should return true if there are no queued events', function() {
      assert(ee.dequeue());
    });

    it('should return true if every queued event has a listener', function() {
      ee.queue('foo', 'bar');
      ee.queue('baz', 'qux');
      ee.on('foo', function() {});
      ee.on('baz', function() {});
      assert(ee.dequeue());
    });

    it('should return false if any queued event has no listener', function() {
      ee.queue('foo', 'bar');
      ee.queue('baz', 'qux');
      ee.on('foo', function() {});
      assert(!ee.dequeue());

      ee.queue('baz', 'qux');
      ee.queue('baz', 'quux');
      ee.once('baz', function() {});
      assert(!ee.dequeue());
    });
  });

  describe('#dequeue(event)', function() {
    it('should return true if there are no queued events', function() {
      assert(ee.dequeue());
    });

    it('should return true if every queued event has a listener', function() {
      ee.queue('foo', 'bar');
      ee.queue('foo', 'baz');
      ee.on('foo', function() {});
      assert(ee.dequeue('foo'));
    });

    it('should return false if any queued event has no listener', function() {
      ee.queue('foo', 'bar');
      ee.queue('foo', 'baz');
      ee.once('foo', function() {});
      assert(!ee.dequeue('foo'));
    });
  });
});
