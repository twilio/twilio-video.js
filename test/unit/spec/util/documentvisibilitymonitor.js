const assert = require('assert');
const sinon = require('sinon');
const Document = require('../../../lib/document');
const documentVisibilityMonitor = require('../../../../lib/util/documentvisibilitymonitor');
const { defer, waitForSometime } = require('../../../../lib/util');
const { describe } = require('mocha');

describe('DocumentVisibilityMonitor', () => {
  let addEventListenerStub;
  let removeEventListenerStub;

  before(() => {
    documentVisibilityMonitor.clear();
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
    [-1, 0, 3, 'some string', undefined, null].forEach(phase => {
      it(`onVisibilityChange throws for invalid phase value: ${phase}`, () => {
        assert.throws(() => documentVisibilityMonitor.onVisibilityChange(phase, () => {}));
      });

      it(`offVisibilityChange throws for invalid phase value: ${phase}`, () => {
        assert.throws(() => documentVisibilityMonitor.offVisibilityChange(phase, () => {}));
      });
    });

    [1, 2].forEach(phase => {
      describe(`phase: ${phase}`, () => {
        beforeEach(() => {
          addEventListenerStub.resetHistory();
          removeEventListenerStub.resetHistory();
        });

        it('registers and un-registers for visibility change', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          documentVisibilityMonitor.onVisibilityChange(phase, callback);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.offVisibilityChange(phase, callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('registers for visibility change just once', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          documentVisibilityMonitor.onVisibilityChange(phase, callback);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.onVisibilityChange(phase, callback);
          sinon.assert.callCount(document.addEventListener, 1);

          documentVisibilityMonitor.offVisibilityChange(phase, callback);
          sinon.assert.callCount(document.removeEventListener, 0);

          documentVisibilityMonitor.offVisibilityChange(phase, callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('callback function can return sync', async () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);
          const deferred = defer();

          const callback = isVisible => {
            assert(isVisible);
            deferred.resolve();
          };

          documentVisibilityMonitor.onVisibilityChange(phase, callback);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          documentVisibilityMonitor.offVisibilityChange(phase, callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('callback may also return async ', async () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);
          const deferred = defer();

          const callback = async isVisible => {
            assert(isVisible);
            await waitForSometime(100);
            deferred.resolve();
          };

          documentVisibilityMonitor.onVisibilityChange(phase, callback);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          documentVisibilityMonitor.offVisibilityChange(phase, callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        [true, false].forEach(isVisible => {
          it(`callback function is passed isVisible=${isVisible} when document becomes ${isVisible ? 'visible' : 'invisible'}`, async () => {
            sinon.assert.callCount(document.addEventListener, 0);
            sinon.assert.callCount(document.removeEventListener, 0);
            const deferred = defer();

            const callback = gotVisible => {
              assert(isVisible === gotVisible);
              deferred.resolve();
            };

            documentVisibilityMonitor.onVisibilityChange(phase, callback);
            sinon.assert.callCount(document.addEventListener, 1);


            global.document.visibilityState = isVisible ? 'visible' : 'hidden';
            global.document.dispatchEvent('visibilitychange');

            await deferred.promise;

            documentVisibilityMonitor.offVisibilityChange(phase, callback);
            sinon.assert.callCount(document.removeEventListener, 1);

          });
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

        documentVisibilityMonitor.onVisibilityChange(2, phase2Callback);
        documentVisibilityMonitor.onVisibilityChange(1, phase1Callback);
        documentVisibilityMonitor.onVisibilityChange(1, phase1Callback);

        global.document.visibilityState = 'visible';
        global.document.dispatchEvent('visibilitychange');

        await deferred.promise;
        assert.equal(phase1Called, 2);
        assert.equal(phase2Called, 1);

        documentVisibilityMonitor.offVisibilityChange(2, phase2Callback);
        documentVisibilityMonitor.offVisibilityChange(1, phase1Callback);
        documentVisibilityMonitor.offVisibilityChange(1, phase1Callback);
      });
    });
  });
});
