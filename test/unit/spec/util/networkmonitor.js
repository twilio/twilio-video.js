'use strict';

const assert = require('assert');
const sinon = require('sinon');

const NetworkMonitor = require('../../../../lib/util/networkmonitor');

class MockConnection {
  constructor() {
    this.type = 'whiz';
    this.listeners = {};
  }
  addEventListener(event, listener) {
    this.listeners[event] = listener;
  }
  removeEventListener(event) {
    delete this.listeners[event];
  }
  emit(event) {
    if (this.listeners[event]) {
      this.listeners[event]();
    }
  }
}

class MockWindow {
  constructor() {
    this.listeners = {};
  }
  addEventListener(event, listener) {
    this.listeners[event] = listener;
  }
  removeEventListener(event) {
    delete this.listeners[event];
  }
  emit(event) {
    if (this.listeners[event]) {
      this.listeners[event]();
    }
  }
}

describe('NetworkMonitor', () => {
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
        removeEventListener: sinon.spy(),
        type: 'wifi'
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

    it('should call start twice for each event on target nav', () => {
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
      networkMonitor.start();
      sinon.assert.calledTwice(nav.connection.addEventListener);
    });

    it('should call stop twice for each event on target nav', () => {
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
      networkMonitor.stop();
      sinon.assert.calledTwice(nav.connection.removeEventListener);
    });
  });

  describe('onNetworkChanged', () => {
    const nav = {
      onLine: true,
      connection: new MockConnection(),
    };

    it('should call the function when network has typechanged on navigator', () => {
      const networkChangedCalled = sinon.spy();
      const networkMonitor = new NetworkMonitor(networkChangedCalled, { navigator: nav });
      networkMonitor.start();
      nav.connection.type = 'bang';
      nav.connection.emit('typechange');
      sinon.assert.calledOnce(networkChangedCalled);
    });

    it('should call the function when network has changed on navigator', () => {
      const networkChangedCalled = sinon.spy();
      const networkMonitor = new NetworkMonitor(networkChangedCalled, { navigator: nav });
      networkMonitor.start();
      nav.connection.type = 'whiz';
      nav.connection.emit('change');
      sinon.assert.calledOnce(networkChangedCalled);
    });

    it('should call the function when event is online on window', () => {
      const win = new MockWindow();
      const networkChangedCalled = sinon.spy();
      const networkMonitor = new NetworkMonitor(networkChangedCalled, { window: win });
      networkMonitor.start();
      win.emit('online');
      sinon.assert.calledOnce(networkChangedCalled);
    });
  });
});
