'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const MediaStreamEventPublisher = require('../../../../lib/insights/mediastreameventpublisher');

describe('MediaStreamEventPublisher', () => {
  let eventObserver;
  let mockLog;
  let publisher;
  let emittedEvents;

  beforeEach(() => {
    eventObserver = new EventEmitter();
    mockLog = {
      debug: sinon.stub(),
      error: sinon.stub()
    };
    publisher = new MediaStreamEventPublisher(eventObserver, mockLog);
    emittedEvents = [];

    eventObserver.on('event', event => {
      emittedEvents.push(event);
    });
  });

  describe('reportSuccess', () => {
    it('should emit succeeded event with correct structure', () => {
      publisher.reportSuccess();

      assert.strictEqual(emittedEvents.length, 1);
      const event = emittedEvents[0];
      assert.strictEqual(event.group, 'get-user-media');
      assert.strictEqual(event.name, 'succeeded');
      assert.strictEqual(event.level, 'info');
      assert.strictEqual(event.payload, undefined);
    });
  });

  describe('reportPermissionDenied', () => {
    it('should emit denied event with correct structure', () => {
      publisher.reportPermissionDenied();

      assert.strictEqual(emittedEvents.length, 1);
      const event = emittedEvents[0];
      assert.strictEqual(event.group, 'get-user-media');
      assert.strictEqual(event.name, 'denied');
      assert.strictEqual(event.level, 'info');
      assert.strictEqual(event.payload, undefined);
    });
  });

  describe('reportFailure', () => {
    it('should emit failed event with error details', () => {
      const testError = new Error('Test error message');
      testError.name = 'TestError';

      publisher.reportFailure(testError);

      assert.strictEqual(emittedEvents.length, 1);
      const event = emittedEvents[0];
      assert.strictEqual(event.group, 'get-user-media');
      assert.strictEqual(event.name, 'failed');
      assert.strictEqual(event.level, 'info');

      assert(event.payload);
      assert(event.payload.error);
      assert.strictEqual(event.payload.error.name, 'TestError');
      assert.strictEqual(event.payload.error.message, 'Test error message');
    });
  });

  describe('event emission behavior', () => {
    it('should emit multiple events in sequence', () => {
      publisher.reportSuccess();
      publisher.reportPermissionDenied();
      publisher.reportFailure(new Error('test'));

      assert.strictEqual(emittedEvents.length, 3);
      assert.strictEqual(emittedEvents[0].name, 'succeeded');
      assert.strictEqual(emittedEvents[1].name, 'denied');
      assert.strictEqual(emittedEvents[2].name, 'failed');
    });
  });
});
