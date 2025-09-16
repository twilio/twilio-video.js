'use strict';

const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const sinon = require('sinon');

const fakeLog = require('../../../lib/fakelog');
const BufferedEventPublisher = require('../../../../lib/insights/bufferedeventpublisher');

describe('BufferedEventPublisher', () => {
  let eventObserver;
  let publisher;
  let emittedEvents;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    eventObserver = new EventEmitter();
    publisher = new BufferedEventPublisher(eventObserver, fakeLog);
    emittedEvents = [];

    eventObserver.on('event', event => emittedEvents.push(event));
  });

  afterEach(() => {
    clock.restore();
  });

  it('should initialize with default options', () => {
    assert(publisher._enabled);
    assert.strictEqual(publisher._publishIntervalMs, 10000);
    assert.deepStrictEqual(publisher._pendingEvents, []);
  });

  it('should initialize with custom options', () => {
    const customPublisher = new BufferedEventPublisher(eventObserver, fakeLog, {
      publishIntervalMs: 5000
    });
    assert(customPublisher._enabled);
    assert.strictEqual(customPublisher._publishIntervalMs, 5000);
  });

  it('should buffer events when enabled', () => {
    const event = { group: 'test', name: 'buffered', level: 'info' };
    publisher._bufferEvent(event);
    assert.strictEqual(emittedEvents.length, 0);
    assert.strictEqual(publisher._pendingEvents.length, 1);
    assert.deepStrictEqual(publisher._pendingEvents[0], event);
  });

  it('should publish events immediately when disabled', () => {
    publisher.disable();
    const event = { group: 'test', name: 'immediate', level: 'info' };
    publisher._bufferEvent(event);
    assert.strictEqual(emittedEvents.length, 1);
    assert.strictEqual(publisher._pendingEvents.length, 0);
    assert.deepStrictEqual(emittedEvents[0], event);
  });

  it('should flush events when requested', () => {
    const events = [
      { group: 'test', name: 'event1', level: 'info' },
      { group: 'test', name: 'event2', level: 'info' }
    ];

    events.forEach(event => publisher._bufferEvent(event));
    assert.strictEqual(emittedEvents.length, 0);

    publisher.flush();
    assert.strictEqual(emittedEvents.length, 2);
    assert.deepStrictEqual(emittedEvents, events);
    assert.strictEqual(publisher._pendingEvents.length, 0);
  });

  it('should do nothing when flushing with no pending events', () => {
    publisher.flush();
    assert.strictEqual(emittedEvents.length, 0);
  });

  it('should automatically flush events at the publish interval', () => {
    const events = [
      { group: 'test', name: 'event1', level: 'info' },
      { group: 'test', name: 'event2', level: 'info' }
    ];

    events.forEach(event => publisher._bufferEvent(event));
    assert.strictEqual(emittedEvents.length, 0);

    // Advance time to trigger flush
    clock.tick(10000);
    assert.strictEqual(emittedEvents.length, 2);
    assert.deepStrictEqual(emittedEvents, events);
  });

  it('should schedule next publish after flushing', () => {
    const event = { group: 'test', name: 'event1', level: 'info' };

    publisher._bufferEvent(event);
    clock.tick(10000);
    assert.strictEqual(emittedEvents.length, 1);

    // Add new event and verify it gets published in next interval
    emittedEvents = [];
    const nextEvent = { group: 'test', name: 'event2', level: 'info' };
    publisher._bufferEvent(nextEvent);

    clock.tick(10000);
    assert.strictEqual(emittedEvents.length, 1);
    assert.deepStrictEqual(emittedEvents[0], nextEvent);
  });

  it('should disable buffering and flush pending events', () => {
    const events = [
      { group: 'test', name: 'event1', level: 'info' },
      { group: 'test', name: 'event2', level: 'info' }
    ];

    events.forEach(event => publisher._bufferEvent(event));
    assert.strictEqual(emittedEvents.length, 0);

    publisher.disable(true);
    assert.strictEqual(emittedEvents.length, 2);
    assert.deepStrictEqual(emittedEvents, events);
    assert.strictEqual(publisher._pendingEvents.length, 0);
    assert(!publisher._enabled);
  });

  it('should disable buffering without flushing pending events if specified', () => {
    const events = [
      { group: 'test', name: 'event1', level: 'info' },
      { group: 'test', name: 'event2', level: 'info' }
    ];

    events.forEach(event => publisher._bufferEvent(event));
    publisher.disable(false);
    assert.strictEqual(emittedEvents.length, 0);
    assert(!publisher._enabled);
  });

  it('should re-enable buffering after being disabled', () => {
    publisher.disable();
    assert(!publisher._enabled);

    publisher.enable();
    assert(publisher._enabled);

    const event = { group: 'test', name: 'buffered', level: 'info' };
    publisher._bufferEvent(event);
    assert.strictEqual(emittedEvents.length, 0);
    assert.strictEqual(publisher._pendingEvents.length, 1);
  });

  it('should update publish interval when requested', () => {
    const event = { group: 'test', name: 'event1', level: 'info' };

    publisher._bufferEvent(event);
    publisher.setPublishInterval(5000);

    // Advance time to new interval
    clock.tick(5000);
    assert.strictEqual(emittedEvents.length, 1);
    assert.deepStrictEqual(emittedEvents[0], event);
  });

  it('should clean up resources with cleanup method', () => {
    const disableSpy = sinon.spy(publisher, 'disable');

    publisher.cleanup();

    assert(disableSpy.calledOnce);
    assert(disableSpy.calledWith(true));

    disableSpy.restore();
  });
});