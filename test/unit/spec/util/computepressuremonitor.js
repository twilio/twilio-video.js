'use strict';

const assert = require('assert');
const sinon = require('sinon');
const computePressureMonitor = require('../../../../lib/insights/computepressuremonitor');

describe('ComputePressureMonitor', () => {
  let mockPressureObserver;
  let observerInstance;
  let originalPressureObserver;

  beforeEach(() => {
    observerInstance = {
      observe: sinon.stub().resolves(),
      disconnect: sinon.spy(),
      unobserve: sinon.spy()
    };

    mockPressureObserver = sinon.stub().returns(observerInstance);

    originalPressureObserver = globalThis.PressureObserver;
    globalThis.PressureObserver = mockPressureObserver;
  });

  afterEach(() => {
    computePressureMonitor.cleanup();
    globalThis.PressureObserver = originalPressureObserver;
  });

  describe('isSupported', () => {
    it('should return true when PressureObserver is available', () => {
      assert.strictEqual(computePressureMonitor.isSupported(), true);
    });

    it('should return false when PressureObserver is not available', () => {
      delete globalThis.PressureObserver;
      assert.strictEqual(computePressureMonitor.isSupported(), false);
    });
  });

  describe('watchCpuPressure', () => {
    it('should throw an error if callback is not a function', async () => {
      await assert.rejects(async () => {
        await computePressureMonitor.watchCpuPressure('not a function');
      }, /The CPU pressure change callback must be a function/);
    });

    it('should throw an error if PressureObserver is not supported', async () => {
      delete globalThis.PressureObserver;
      await assert.rejects(async () => {
        await computePressureMonitor.watchCpuPressure(() => {});
      }, /PressureObserver is not supported in this environment/);
    });

    it('should create PressureObserver only once', async () => {
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();

      await computePressureMonitor.watchCpuPressure(callback1);
      await computePressureMonitor.watchCpuPressure(callback2);

      sinon.assert.calledOnce(mockPressureObserver);
      sinon.assert.calledWith(observerInstance.observe, 'cpu', {
        sampleInterval: 2000
      });
    });

    it('should trigger callback when pressure state changes', async () => {
      const callback = sinon.spy();
      await computePressureMonitor.watchCpuPressure(callback);

      const mockRecord = {
        state: 'critical',
        source: 'cpu',
        time: Date.now(),
      };

      // Simulate pressure observer callback
      const observerCallback = mockPressureObserver.getCall(0).args[0];
      observerCallback([mockRecord]);

      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, mockRecord);
    });
  });

  describe('unwatchCpuPressure', () => {
    it('should remove callback and call disconnect when no listeners remain', async () => {
      const callback = sinon.spy();
      await computePressureMonitor.watchCpuPressure(callback);

      assert.strictEqual(computePressureMonitor._cpuPressureChangeListeners.length, 1);

      computePressureMonitor.unwatchCpuPressure(callback);

      assert.strictEqual(computePressureMonitor._cpuPressureChangeListeners.length, 0);
      sinon.assert.calledOnce(observerInstance.disconnect);
    });
  });

  describe('pressure state change detection', () => {
    it('should only trigger callbacks when state actually changes', async () => {
      const callback = sinon.spy();
      await computePressureMonitor.watchCpuPressure(callback);

      const observerCallback = mockPressureObserver.getCall(0).args[0];

      // First call with 'nominal' state
      const record1 = {
        state: 'nominal',
        source: 'cpu',
        time: '123',
      };

      observerCallback([record1]);
      sinon.assert.calledOnce(callback);

      // Second call with same 'nominal' state should not trigger
      const record2 = {
        state: 'nominal',
        source: 'cpu',
        time: '124',
      };
      observerCallback([record2]);
      sinon.assert.calledOnce(callback);

      // Third call with 'critical' state should trigger
      const record3 = {
        state: 'critical',
        source: 'cpu',
        time: '125',
      };
      observerCallback([record3]);
      sinon.assert.calledTwice(callback);
    });

    it('should use the last record when multiple records are provided', async () => {
      const callback = sinon.spy();
      await computePressureMonitor.watchCpuPressure(callback);

      const observerCallback = mockPressureObserver.getCall(0).args[0];

      const record1 = {
        state: 'nominal',
        source: 'cpu',
        time: '123',
      };

      const record2 = {
        state: 'critical',
        source: 'cpu',
        time: '456',
      };

      observerCallback([record1, record2]);

      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, record2);
    });
  });

  describe('cleanup', () => {
    it('should disconnect observer and reset state', async () => {
      const callback = sinon.spy();
      await computePressureMonitor.watchCpuPressure(callback);

      computePressureMonitor.cleanup();

      assert.strictEqual(computePressureMonitor._cpuPressureChangeListeners.length, 0);
      assert.strictEqual(computePressureMonitor._cpuPressureObserver, null);
      sinon.assert.calledOnce(observerInstance.disconnect);
    });

    it('should handle cleanup when no observer exists', () => {
      assert.doesNotThrow(() => {
        computePressureMonitor.cleanup();
      });
    });
  });
});
