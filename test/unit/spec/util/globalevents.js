const assert = require('assert');
const sinon = require('sinon');
const Document = require('../../../lib/document');
const globalEvents = require('../../../../lib/util/globalevents');
const { defer, waitForSometime } = require('../../../../lib/util');
// const { waitForSometime } = require('../../../lib/util');

describe('GlobalEvents', () => {
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
    const globalEvents1 = require('../../../../lib/util/GlobalEvents');
    const globalEvents2 = require('../../../../lib/util/GlobalEvents');
    assert.equal(globalEvents1, globalEvents2);
  });

  describe('constructor', () => {
    it('does not register for document events', () => {
      sinon.assert.callCount(document.addEventListener, 0);
    });
  });

  describe('document visibility events: ', () => {
    ['phase1', 'phase2'].forEach(phase => {
      const phases = {
        'phase1': {
          registerFunction: 'onVisiblePhase1',
          unRegisterFunction: 'offVisiblePhase1'
        },
        'phase2': {
          registerFunction: 'onVisiblePhase1',
          unRegisterFunction: 'offVisiblePhase1'
        }
      };

      describe(`phase: ${phase}`, () => {
        beforeEach(() => {
          addEventListenerStub.resetHistory();
          removeEventListenerStub.resetHistory();
        });

        it('registers and un-registers for visibility change', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          globalEvents[phases[phase].registerFunction](callback);
          sinon.assert.callCount(document.addEventListener, 1);

          globalEvents[phases[phase].unRegisterFunction](callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('registers for visibility change just once', () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);

          const callback = () => {};
          globalEvents[phases[phase].registerFunction](callback);
          sinon.assert.callCount(document.addEventListener, 1);

          globalEvents[phases[phase].registerFunction](callback);
          sinon.assert.callCount(document.addEventListener, 1);

          globalEvents[phases[phase].unRegisterFunction](callback);
          sinon.assert.callCount(document.removeEventListener, 0);

          globalEvents[phases[phase].unRegisterFunction](callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });

        it('callback function can return sync', async () => {
          sinon.assert.callCount(document.addEventListener, 0);
          sinon.assert.callCount(document.removeEventListener, 0);
          const deferred = defer();

          const callback = () => {
            deferred.resolve();
          };

          globalEvents[phases[phase].registerFunction](callback);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          globalEvents[phases[phase].unRegisterFunction](callback);
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

          globalEvents[phases[phase].registerFunction](callback);
          sinon.assert.callCount(document.addEventListener, 1);

          global.document.visibilityState = 'visible';
          global.document.dispatchEvent('visibilitychange');

          await deferred.promise;

          globalEvents[phases[phase].unRegisterFunction](callback);
          sinon.assert.callCount(document.removeEventListener, 1);
        });
      });
    });

    describe('event sequencing', () => {
      it('for visibility phase1 gets called before phase 2', done => {
        let phase1Called = 0;
        let phase2Called = 0;

        const phase1CallBack = async () => {
          assert.equal(phase2Called, 0);
          phase1Called++;
          await waitForSometime(500);
          assert.equal(phase2Called, 0);
        };

        const phase2Callback = () => {
          assert.equal(phase1Called, 2);
          phase2Called++;
          done();
        };

        globalEvents.onVisiblePhase2(phase2Callback);

        globalEvents.onVisiblePhase1(phase1CallBack);
        globalEvents.onVisiblePhase1(phase1CallBack);

        global.document.visibilityState = 'visible';
        global.document.dispatchEvent('visibilitychange');
      });
    });
  });
});
