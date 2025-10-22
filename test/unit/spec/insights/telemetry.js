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
      telemetry.info({ group: 'test', name: 'event' });

      sinon.assert.calledOnce(firstObserver.emit);
      sinon.assert.calledWith(firstObserver.emit, 'event', {
        name: 'event',
        group: 'test',
        level: 'info'
      });

      // Register second observer
      telemetry.registerObserver(secondObserver);
      telemetry.info({ group: 'test', name: 'event2' });

      // First observer should not receive new events
      sinon.assert.calledOnce(firstObserver.emit);
      // Second observer should receive the event
      sinon.assert.calledOnce(secondObserver.emit);
      sinon.assert.calledWith(secondObserver.emit, 'event', {
        name: 'event2',
        group: 'test',
        level: 'info'
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
      telemetry.info({ group: 'test', name: 'event1' });

      sinon.assert.calledOnce(mockObserver.emit);

      telemetry.unregisterObserver();
      telemetry.info({ group: 'test', name: 'event2' });

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

  describe('convenience methods', () => {
    it('should not include payload if not provided', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.info({ group: 'quality', name: 'stats-report' });

      sinon.assert.calledOnce(mockObserver.emit);
      const eventArg = mockObserver.emit.getCall(0).args[1];
      assert.strictEqual('payload' in eventArg, false);
    });

    it('should be a no-op when no observer is registered', () => {
      // Should not throw
      telemetry.info({ group: 'test', name: 'event' });
      telemetry.warning({ group: 'test', name: 'event' });
      telemetry.error({ group: 'test', name: 'event' });
      assert.strictEqual(telemetry.isEnabled, false);
    });

    it('should handle multiple events at different levels', () => {
      telemetry.registerObserver(mockObserver);

      telemetry.info({ group: 'network', name: 'type-changed', payload: { type: 'wifi' } });
      telemetry.warning({ group: 'quality', name: 'limitation-changed', payload: { reason: 'cpu' } });
      telemetry.error({ group: 'connection', name: 'failed' });

      sinon.assert.calledThrice(mockObserver.emit);

      sinon.assert.calledWith(mockObserver.emit.getCall(0), 'event', {
        name: 'type-changed',
        group: 'network',
        level: 'info',
        payload: {
          type: 'wifi'
        }
      });

      sinon.assert.calledWith(mockObserver.emit.getCall(1), 'event', {
        name: 'limitation-changed',
        group: 'quality',
        level: 'warning',
        payload: {
          reason: 'cpu'
        }
      });

      sinon.assert.calledWith(mockObserver.emit.getCall(2), 'event', {
        name: 'failed',
        group: 'connection',
        level: 'error'
      });
    });
  });

  describe('info', () => {
    it('should emit info-level events', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.info({ group: 'get-user-media', name: 'succeeded' });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'succeeded',
        group: 'get-user-media',
        level: 'info'
      });
    });

    it('should emit info-level events with payload', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.info({ group: 'network', name: 'type-changed', payload: { networkType: 'wifi' } });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'type-changed',
        group: 'network',
        level: 'info',
        payload: {
          networkType: 'wifi'
        }
      });
    });
  });

  describe('warning', () => {
    it('should emit warning-level events', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.warning({ group: 'track-warning-raised', name: 'track-stalled' });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'track-stalled',
        group: 'track-warning-raised',
        level: 'warning'
      });
    });

    it('should emit warning-level events with payload', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.warning({ group: 'quality', name: 'degraded', payload: { reason: 'cpu' } });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'degraded',
        group: 'quality',
        level: 'warning',
        payload: {
          reason: 'cpu'
        }
      });
    });
  });

  describe('error', () => {
    it('should emit error-level events', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.error({ group: 'connection', name: 'failed' });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'failed',
        group: 'connection',
        level: 'error'
      });
    });

    it('should emit error-level events with payload', () => {
      telemetry.registerObserver(mockObserver);
      telemetry.error({ group: 'connection', name: 'failed', payload: { reason: 'timeout' } });

      sinon.assert.calledOnce(mockObserver.emit);
      sinon.assert.calledWith(mockObserver.emit, 'event', {
        name: 'failed',
        group: 'connection',
        level: 'error',
        payload: {
          reason: 'timeout'
        }
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
