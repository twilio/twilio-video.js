'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ResourceMonitor = require('../../../../lib/insights/resourcemonitor');

describe('ResourceMonitor', () => {
  let eventObserver;
  let log;
  let resourceMonitor;
  let computePressureMonitor;

  beforeEach(() => {
    eventObserver = {
      emit: sinon.spy()
    };

    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };

    computePressureMonitor = require('../../../../lib/insights/computepressuremonitor');
  });

  afterEach(() => {
    if (resourceMonitor) {
      resourceMonitor.cleanup();
      resourceMonitor = null;
    }
  });

  describe('CPU pressure monitoring', () => {
    beforeEach(() => {
      sinon.stub(computePressureMonitor, 'isSupported').returns(true);
      sinon.stub(computePressureMonitor, 'watchCpuPressure').resolves();
      resourceMonitor = new ResourceMonitor(eventObserver, log);
      eventObserver.emit.resetHistory();
    });

    afterEach(() => {
      computePressureMonitor.isSupported.restore();
      computePressureMonitor.watchCpuPressure.restore();
    });

    it('should emit event when CPU pressure changes', () => {
      resourceMonitor._cpuPressureHandler({ state: 'serious' });

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'system',
        name: 'cpu-pressure-changed',
        level: 'info',
        payload: {
          resourceType: 'cpu',
          pressure: 'serious'
        }
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up CPU pressure handler', () => {
      const isSupported = sinon.stub(computePressureMonitor, 'isSupported').returns(true);
      const watchCpuPressure = sinon.stub(computePressureMonitor, 'watchCpuPressure').resolves();
      const unwatchCpuPressure = sinon.stub(computePressureMonitor, 'unwatchCpuPressure');

      resourceMonitor = new ResourceMonitor(eventObserver, log);
      const handler = resourceMonitor._cpuPressureHandler;

      resourceMonitor.cleanup();

      sinon.assert.calledWith(unwatchCpuPressure, handler);
      assert.strictEqual(resourceMonitor._cpuPressureHandler, null);

      isSupported.restore();
      watchCpuPressure.restore();
      unwatchCpuPressure.restore();
    });
  });
});
