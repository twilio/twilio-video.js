'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ApplicationMonitor = require('../../../../lib/insights/applicationmonitor');
const telemetry = require('../../../../lib/insights/telemetry');

describe('ApplicationMonitor', () => {
  let log;
  let applicationMonitor;
  let resumedSpy;
  let backgroundedSpy;
  let terminatedSpy;

  beforeEach(() => {
    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };

    resumedSpy = sinon.spy(telemetry.application, 'resumed');
    backgroundedSpy = sinon.spy(telemetry.application, 'backgrounded');
    terminatedSpy = sinon.spy(telemetry.application, 'terminated');
  });

  afterEach(() => {
    if (applicationMonitor) {
      applicationMonitor.cleanup();
      applicationMonitor = null;
    }
    resumedSpy.restore();
    backgroundedSpy.restore();
    terminatedSpy.restore();
  });

  describe('visibility change handling', () => {
    beforeEach(() => {
      applicationMonitor = new ApplicationMonitor(log);
      resumedSpy.resetHistory();
      backgroundedSpy.resetHistory();
    });

    it('should call telemetry.application.resumed() when becoming visible', () => {
      applicationMonitor._handleVisibilityChange(true);

      sinon.assert.calledOnce(resumedSpy);
    });

    it('should call telemetry.application.backgrounded() when becoming hidden', () => {
      applicationMonitor._handleVisibilityChange(false);

      sinon.assert.calledOnce(backgroundedSpy);
    });
  });

  describe('beforeunload handling', () => {
    it('should call telemetry.application.terminated()', () => {
      applicationMonitor = new ApplicationMonitor(log);
      terminatedSpy.resetHistory();

      applicationMonitor._handleBeforeUnload();

      sinon.assert.calledOnce(terminatedSpy);
    });
  });

  describe('cleanup', () => {
    it('should clean up handlers', () => {
      applicationMonitor = new ApplicationMonitor(log);

      applicationMonitor.cleanup();

      assert.strictEqual(applicationMonitor._visibilityChangeHandler, null);
    });
  });
});
