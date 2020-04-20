'use strict';

const assert = require('assert');
const sinon = require('sinon');

const NetworkMonitor = require('../../../../lib/util/networkmonitor');

describe.only('NetworkMonitor', () => {
  const onNetworkChangedCalled = sinon.spy();

  describe('constructor', () => {
    it('should return an instance of NetworkMonitor', () => {
      const networkMonitor = new NetworkMonitor();
      assert(networkMonitor instanceof NetworkMonitor);
    });

    [true, false].forEach(bool => {
      it(`should return ${bool} when accessing isOnline`, () => {
        const navigator = { onLine: bool };
        const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator });
        assert.equal(networkMonitor.isOnline, bool);
      });
    });

    [{ connection: { type: 'wifi' } }, { connection: {} }, {}].forEach(el => {
      it(`should return ${(el.connection && el.connection.type) || null} when accessing type`, () => {
        const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: el });

        if (el.connection && el.connection.type) {
          assert.equal(networkMonitor.type, el.connection.type);
        } else {
          assert.equal(networkMonitor.type, null);
        }
      });
    });
  });

  describe('start and stop methods', () => {
    const nav = {
      connection: {
        addEventListener: sinon.spy(),
        removeEventListener: sinon.spy()
      }
    };

    const win = {
      addEventListener: sinon.spy(),
      removeEventListener: sinon.spy()
    };

    it('should call start once for online event on target window', () => {
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { window: win });
      networkMonitor.start();
      sinon.assert.calledOnce(win.addEventListener);
    });

    it('should call stop once for online event on target window', () => {
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { window: win });
      networkMonitor.stop();
      sinon.assert.calledOnce(win.removeEventListener);
    });

    ['change', 'typechange'].forEach(event => {
      let networkMonitor;

      beforeEach(() => {
        nav.connection.type = event;
      });

      afterEach(() => {
        delete nav.connection.type;
      });

      it(`should call start once for event ${event} on target nav`, () => {
        networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
        networkMonitor.start();
        sinon.assert.calledOnce(nav.connection.addEventListener);
      });

      it(`should call stop once for event ${event} on target nav`, () => {
        networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
        networkMonitor.stop();
        sinon.assert.calledOnce(nav.connection.removeEventListener);
      });
    });
  });
});
