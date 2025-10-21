'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ApplicationMonitor = require('../../../../lib/insights/applicationmonitor');

describe('ApplicationMonitor', () => {
  let eventObserver;
  let log;
  let applicationMonitor;

  beforeEach(() => {
    eventObserver = {
      emit: sinon.spy()
    };

    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };
  });

  afterEach(() => {
    if (applicationMonitor) {
      applicationMonitor.cleanup();
      applicationMonitor = null;
    }
  });

  describe('visibility change handling', () => {
    beforeEach(() => {
      applicationMonitor = new ApplicationMonitor(eventObserver, log);
      eventObserver.emit.resetHistory();
    });

    it('should emit "resumed" event when becoming visible', () => {
      applicationMonitor._handleVisibilityChange(true);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'application',
        name: 'resumed',
        level: 'info'
      });
    });

    it('should emit "backgrounded" event when becoming hidden', () => {
      applicationMonitor._handleVisibilityChange(false);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'application',
        name: 'backgrounded',
        level: 'info'
      });
    });
  });

  describe('beforeunload handling', () => {
    it('should emit "terminated" event', () => {
      applicationMonitor = new ApplicationMonitor(eventObserver, log);
      eventObserver.emit.resetHistory();

      applicationMonitor._handleBeforeUnload();

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'application',
        name: 'terminated',
        level: 'info'
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up handlers', () => {
      applicationMonitor = new ApplicationMonitor(eventObserver, log);

      applicationMonitor.cleanup();

      assert.strictEqual(applicationMonitor._visibilityChangeHandler, null);
    });
  });
});
