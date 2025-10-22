'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ResourceMonitor = require('../../../../lib/insights/resourcemonitor');
const telemetry = require('../../../../lib/insights/telemetry');

describe('ResourceMonitor', () => {
  let log;
  let resourceMonitor;
  let computePressureMonitor;
  let telemetrySpy;

  beforeEach(() => {
    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };

    computePressureMonitor = require('../../../../lib/insights/computepressuremonitor');
    telemetrySpy = sinon.spy(telemetry, 'info');
  });

  afterEach(() => {
    if (resourceMonitor) {
      resourceMonitor.cleanup();
      resourceMonitor = null;
    }
    telemetrySpy.restore();
  });

  describe('CPU pressure monitoring', () => {
    beforeEach(() => {
      sinon.stub(computePressureMonitor, 'isSupported').returns(true);
      sinon.stub(computePressureMonitor, 'watchCpuPressure').resolves();
      resourceMonitor = new ResourceMonitor({ log });
      telemetrySpy.resetHistory();
    });

    afterEach(() => {
      computePressureMonitor.isSupported.restore();
      computePressureMonitor.watchCpuPressure.restore();
    });

    it('should emit event when CPU pressure changes', () => {
      resourceMonitor._cpuPressureHandler({ state: 'serious' });

      sinon.assert.calledWith(telemetrySpy, {
        group: 'system',
        name: 'cpu-pressure-changed',
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

      resourceMonitor = new ResourceMonitor({ log });
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
