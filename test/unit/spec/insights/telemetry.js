'use strict';

const assert = require('assert');
const sinon = require('sinon');
const telemetry = require('../../../../lib/insights/telemetry');

describe('Telemetry', () => {
  let mockObserver;

  beforeEach(() => {
    mockObserver = {
      emit: sinon.spy()
    };
  });

  afterEach(() => {
    // Always cleanup after tests
    telemetry.unregisterObserver();
  });

  describe('registerObserver', () => {
    it('should register an observer', () => {
      telemetry.registerObserver(mockObserver);
      assert.strictEqual(telemetry.isEnabled, true);
    });

    it('should replace a previously registered observer', () => {
      const firstObserver = { emit: sinon.spy() };
      const secondObserver = { emit: sinon.spy() };

      telemetry.registerObserver(firstObserver);
      telemetry.emit({ group: 'test', name: 'event', payload: { level: 'info' } });

      sinon.assert.calledOnce(firstObserver.emit);
      sinon.assert.calledWith(firstObserver.emit, 'event', {
        name: 'event',
        group: 'test',
        payload: { level: 'info' }
      });

      // Register second observer
      telemetry.registerObserver(secondObserver);
      telemetry.emit({ group: 'test', name: 'event2', payload: { level: 'info' } });

      // First observer should not receive new events
      sinon.assert.calledOnce(firstObserver.emit);
      // Second observer should receive the event
      sinon.assert.calledOnce(secondObserver.emit);
      sinon.assert.calledWith(secondObserver.emit, 'event', {
        name: 'event2',
        group: 'test',
        payload: { level: 'info' }
      });
    });
  });

  describe('unregisterObserver', () => {
    it('should unregister the current observer', () => {
      telemetry.registerObserver(mockObserver);
      assert.strictEqual(telemetry.isEnabled, true);

      telemetry.unregisterObserver();
      assert.strictEqual(telemetry.isEnabled, false);
    });

    it('should stop forwarding events after unregistering', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.emit({ group: 'test', name: 'event1', payload: { level: 'info' } });

      sinon.assert.calledOnce(mockObserver.emit);

      telemetry.unregisterObserver();
      telemetry.emit({ group: 'test', name: 'event2', payload: { level: 'info' } });

      // Should still be called only once (before unregister)
      sinon.assert.calledOnce(mockObserver.emit);
    });

    it('should be safe to call multiple times', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.unregisterObserver();
      telemetry.unregisterObserver(); // Should not throw
      assert.strictEqual(telemetry.isEnabled, false);
    });
  });

  describe('isEnabled', () => {
    it('should return false when no observer is registered', () => {
      assert.strictEqual(telemetry.isEnabled, false);
    });

    it('should return true when an observer is registered', () => {
      telemetry.registerObserver(mockObserver);
      assert.strictEqual(telemetry.isEnabled, true);
    });

    it('should return false after unregistering', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.unregisterObserver();
      assert.strictEqual(telemetry.isEnabled, false);
    });
  });

  describe('emit', () => {
    it('should forward events to observer without modification', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.emit({ group: 'get-user-media', name: 'succeeded', payload: { level: 'info' } });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'succeeded',
        group: 'get-user-media',
        payload: { level: 'info' }
      });
    });

    it('should not include payload if not provided', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.emit({ group: 'quality', name: 'stats-report' });

      sinon.assert.calledOnce(mockObserver.emit);
      const eventArg = mockObserver.emit.getCall(0).args[1];
      assert.strictEqual('payload' in eventArg, false);
    });

    it('should be a no-op when no observer is registered', () => {
      // Should not throw
      telemetry.emit({ group: 'test', name: 'event', payload: { level: 'info' } });
      assert.strictEqual(telemetry.isEnabled, false);
    });

    it('should handle multiple events in sequence', () => {
      telemetry.registerObserver(mockObserver);

      telemetry.emit({ group: 'network', name: 'type-changed', payload: { level: 'info', type: 'wifi' } });
      telemetry.emit({ group: 'quality', name: 'limitation-changed', payload: { level: 'info', reason: 'cpu' } });
      telemetry.emit({ group: 'application', name: 'backgrounded', payload: { level: 'info' } });

      sinon.assert.calledThrice(mockObserver.emit);

      sinon.assert.calledWith(mockObserver.emit.getCall(0), 'event', {
        name: 'type-changed',
        group: 'network',
        payload: {
          level: 'info',
          type: 'wifi'
        }
      });

      sinon.assert.calledWith(mockObserver.emit.getCall(1), 'event', {
        name: 'limitation-changed',
        group: 'quality',
        payload: {
          level: 'info',
          reason: 'cpu'
        }
      });

      sinon.assert.calledWith(mockObserver.emit.getCall(2), 'event', {
        name: 'backgrounded',
        group: 'application',
        payload: { level: 'info' }
      });
    });
  });

  describe('singleton behavior', () => {
    it('should maintain state across requires', () => {
      const telemetry1 = require('../../../../lib/insights/telemetry');
      const telemetry2 = require('../../../../lib/insights/telemetry');

      assert.strictEqual(telemetry1, telemetry2);

      telemetry1.registerObserver(mockObserver);
      assert.strictEqual(telemetry2.isEnabled, true);

      telemetry1.unregisterObserver();
      assert.strictEqual(telemetry2.isEnabled, false);
    });
  });
});
