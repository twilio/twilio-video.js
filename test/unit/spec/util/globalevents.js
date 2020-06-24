const assert = require('assert');
const sinon = require('sinon');
const Document = require('../../../lib/document');
const documentVisibilityMonitor = require('../../../../lib/util/documentvisibilitymonitor');
const { defer, waitForSometime } = require('../../../../lib/util');

describe('DocumentVisibilityMonitor', () => {
  let addEventListenerStub;
  let removeEventListenerStub;

  before(() => {
    global.document = global.document || new Document();
    addEventListenerStub = sinon.spy(document, 'addEventListener');
    removeEventListenerStub = sinon.spy(document, 'removeEventListener');
  });

  after(() => {
    addEventListenerStub.restore();
    removeEventListenerStub.restore();
    if (global.document instanceof Document) {
      delete global.document;
    }
  });

  it('is a singleton', () => {
    const documentVisibilityMonitor1 = require('../../../../lib/util/documentvisibilitymonitor');
    const documentVisibilityMonitor2 = require('../../../../lib/util/documentvisibilitymonitor');
    assert.equal(documentVisibilityMonitor1, documentVisibilityMonitor2);
  });

  describe('constructor', () => {
    it('does not register for document events', () => {
      sinon.assert.callCount(document.addEventListener, 0);
    });
  });

  describe('document visibility events: ', () => {
    it('onVisible throws for unsupported phase', () => {
      assert.throws(() => documentVisibilityMonitor.onVisible(() => {}, 'unsupportedPhase'));
    });

    it('offVisible throws for unsupported phase', () => {
      assert.throws(() => documentVisibilityMonitor.offVisible(() => {}, 'unsupportedPhase'));
    });

    ['phase1', 'phase2'].forEach(phase => {
      describe(`phase: ${phase}`, () => {
        beforeEach(() => {
          addEventListenerStub.resetHistory();
          removeEventListenerStub.resetHistory();
        });

        it('registers and un-registers for visibility change', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          documentVisibilityMonitor.onVisible(callback, phase);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.offVisible(callback, phase);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('registers for visibility change just once', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          documentVisibilityMonitor.onVisible(callback, phase);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.onVisible(callback, phase);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.offVisible(callback, phase);
          sinon.assert.callCount(document.removeEventListener, 0);

          documentVisibilityMonitor.offVisible(callback, phase);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('callback function can return sync', async () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);
          const deferred = defer();

          const callback = () => {
            deferred.resolve();
          };

          documentVisibilityMonitor.onVisible(callback, phase);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          documentVisibilityMonitor.offVisible(callback, phase);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('callback may also return async ', async () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);
          const deferred = defer();

          const callback = async () => {
            await waitForSometime(100);
            deferred.resolve();
          };

          documentVisibilityMonitor.onVisible(callback, phase);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          documentVisibilityMonitor.offVisible(callback, phase);
          sinon.assert.callCount(document.removeEventListener, 1);
        });
      });
    });

    describe('event sequencing', () => {
      it('for visibility phase1 gets called before phase 2', async () => {
        const deferred = defer();
        let phase1Called = 0;
        let phase2Called = 0;

        const phase1Callback = async () => {
          assert.equal(phase2Called, 0);
          phase1Called++;
          await waitForSometime(500);
          assert.equal(phase2Called, 0);
        };

        const phase2Callback = () => {
          assert.equal(phase1Called, 2);
          phase2Called++;
          deferred.resolve();
        };

        documentVisibilityMonitor.onVisible(phase2Callback, 'phase2');
        documentVisibilityMonitor.onVisible(phase1Callback, 'phase1');
        documentVisibilityMonitor.onVisible(phase1Callback, 'phase1');

        global.document.visibilityState = 'visible';
        global.document.dispatchEvent('visibilitychange');

        await deferred.promise;
        assert.equal(phase1Called, 2);
        assert.equal(phase2Called, 1);
      });
    });
  });
});
