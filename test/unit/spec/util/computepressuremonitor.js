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
      observe: sinon.spy(),
      disconnect: sinon.spy()
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
      assert.strictEqual(computePressureMonitor.constructor.isSupported(), true);
    });

    it('should return false when PressureObserver is not available', () => {
      delete globalThis.PressureObserver;
      assert.strictEqual(computePressureMonitor.constructor.isSupported(), false);
    });
  });

  describe('onCpuPressureChange', () => {
    it('should throw an error if callback is not a function', () => {
      assert.throws(() => {
        computePressureMonitor.onCpuPressureChange('not a function');
      }, /The CPU pressure change callback must be a function/);
    });

    it('should create PressureObserver only once', () => {
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();

      computePressureMonitor.onCpuPressureChange(callback1);
      computePressureMonitor.onCpuPressureChange(callback2);

      sinon.assert.calledOnce(mockPressureObserver);
      sinon.assert.calledWith(observerInstance.observe, 'cpu', {
        sampleRate: 10000
      });
    });

    it('should trigger callback when pressure state changes', () => {
      const callback = sinon.spy();
      computePressureMonitor.onCpuPressureChange(callback);

      const mockRecord = {
        state: 'critical',
        source: 'cpu',
        time: Date.now(),
        toJSON: sinon.stub().returns({ state: 'critical', source: 'cpu', time: Date.now() })
      };

      // Simulate pressure observer callback
      const observerCallback = mockPressureObserver.getCall(0).args[0];
      observerCallback([mockRecord]);

      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, mockRecord.toJSON());
    });
  });

  describe('offCpuPressureChange', () => {
    it('should remove callback and call disconnect when no listeners remain', () => {
      const callback = sinon.spy();
      computePressureMonitor.onCpuPressureChange(callback);

      assert.strictEqual(computePressureMonitor._cpuPressureChangeListeners.length, 1);

      computePressureMonitor.offCpuPressureChange(callback);

      assert.strictEqual(computePressureMonitor._cpuPressureChangeListeners.length, 0);
      sinon.assert.calledOnce(observerInstance.disconnect);
    });
  });

  describe('pressure state change detection', () => {
    it('should only trigger callbacks when state actually changes', () => {
      const callback = sinon.spy();
      computePressureMonitor.onCpuPressureChange(callback);

      const observerCallback = mockPressureObserver.getCall(0).args[0];

      // First call with 'nominal' state
      const record1 = {
        state: 'nominal',
        source: 'cpu',
        time: Date.now(),
        toJSON: sinon.stub().returns({ state: 'nominal', source: 'cpu', time: Date.now() })
      };
      observerCallback([record1]);
      sinon.assert.calledOnce(callback);

      // Second call with same 'nominal' state should not trigger
      const record2 = {
        state: 'nominal',
        source: 'cpu',
        time: Date.now() + 1000,
        toJSON: sinon.stub().returns({ state: 'nominal', source: 'cpu', time: Date.now() + 1000 })
      };
      observerCallback([record2]);
      sinon.assert.calledOnce(callback);

      // Third call with 'critical' state should trigger
      const record3 = {
        state: 'critical',
        source: 'cpu',
        time: Date.now() + 2000,
        toJSON: sinon.stub().returns({ state: 'critical', source: 'cpu', time: Date.now() + 2000 })
      };
      observerCallback([record3]);
      sinon.assert.calledTwice(callback);
    });

    it('should use the last record when multiple records are provided', () => {
      const callback = sinon.spy();
      computePressureMonitor.onCpuPressureChange(callback);

      const observerCallback = mockPressureObserver.getCall(0).args[0];

      const record1 = {
        state: 'nominal',
        source: 'cpu',
        time: Date.now(),
        toJSON: sinon.stub().returns({ state: 'nominal', source: 'cpu', time: Date.now() })
      };

      const record2 = {
        state: 'critical',
        source: 'cpu',
        time: Date.now() + 1000,
        toJSON: sinon.stub().returns({ state: 'critical', source: 'cpu', time: Date.now() + 1000 })
      };

      observerCallback([record1, record2]);

      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, record2.toJSON());
    });
  });

  describe('cleanup', () => {
    it('should disconnect observer and reset state', () => {
      const callback = sinon.spy();
      computePressureMonitor.onCpuPressureChange(callback);

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
