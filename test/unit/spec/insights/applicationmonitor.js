'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ApplicationMonitor = require('../../../../lib/insights/applicationmonitor');
const telemetry = require('../../../../lib/insights/telemetry');

describe('ApplicationMonitor', () => {
  let log;
  let applicationMonitor;
  let telemetrySpy;

  beforeEach(() => {
    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };

    telemetrySpy = sinon.spy(telemetry, 'info');
  });

  afterEach(() => {
    if (applicationMonitor) {
      applicationMonitor.cleanup();
      applicationMonitor = null;
    }
    telemetrySpy.restore();
  });

  describe('visibility change handling', () => {
    beforeEach(() => {
      applicationMonitor = new ApplicationMonitor({ log });
      telemetrySpy.resetHistory();
    });

    it('should emit "resumed" event when becoming visible', () => {
      applicationMonitor._handleVisibilityChange(true);

      sinon.assert.calledWith(telemetrySpy, {
        group: 'application',
        name: 'resumed'
      });
    });

    it('should emit "backgrounded" event when becoming hidden', () => {
      applicationMonitor._handleVisibilityChange(false);

      sinon.assert.calledWith(telemetrySpy, {
        group: 'application',
        name: 'backgrounded'
      });
    });
  });

  describe('beforeunload handling', () => {
    it('should emit "terminated" event', () => {
      applicationMonitor = new ApplicationMonitor({ log });
      telemetrySpy.resetHistory();

      applicationMonitor._handleBeforeUnload();

      sinon.assert.calledWith(telemetrySpy, {
        group: 'application',
        name: 'terminated'
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up handlers', () => {
      applicationMonitor = new ApplicationMonitor({ log });

      applicationMonitor.cleanup();

      assert.strictEqual(applicationMonitor._visibilityChangeHandler, null);
    });
  });
});
