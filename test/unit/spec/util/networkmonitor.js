'use strict';

const assert = require('assert');
const sinon = require('sinon');

const MockConnection = require('../../../lib/mockconnection');
const EventTarget = require('../../../../lib/eventtarget');
const NetworkMonitor = require('../../../../lib/util/networkmonitor');

describe('NetworkMonitor', () => {
  let onNetworkChangedCalled;
  let nav;
  let win;

  beforeEach(() => {
    onNetworkChangedCalled = sinon.spy();
    nav = {
      onLine: true,
      connection: new MockConnection(),
    };

    win = new EventTarget();
  });

  describe('constructor', () => {
    it('should return an instance of NetworkMonitor', () => {
      const networkMonitor = new NetworkMonitor();
      assert(networkMonitor instanceof NetworkMonitor);
    });

    [true, false].forEach(bool => {
      it(`should return ${bool} when accessing isOnline`, () => {
        nav.onLine = bool;
        const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
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
    let networkMonitor;

    describe('#window #start #stop', () => {
      beforeEach(() => {
        networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { window: win });
      });

      it('should call start once for online event on target window', () => {
        win.addEventListener = sinon.spy();
        networkMonitor.start();
        sinon.assert.calledOnce(win.addEventListener);
      });

      it('should call stop once for online event on target window', () => {
        win.removeEventListener = sinon.spy();
        networkMonitor.stop();
        sinon.assert.calledOnce(win.removeEventListener);
      });
    });

    describe('#navigator #start #stop', () => {
      beforeEach(() => {
        networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: nav });
      });

      it('should call start twice for each event on target nav', () => {
        nav.connection.addEventListener = sinon.spy();
        networkMonitor.start();
        sinon.assert.calledTwice(nav.connection.addEventListener);
      });

      it('should call stop twice for each event on target nav', () => {
        nav.connection.removeEventListener = sinon.spy();
        networkMonitor.stop();
        sinon.assert.calledTwice(nav.connection.removeEventListener);
      });
    });
  });

  describe('onNetworkChanged', () => {
    let networkMonitor;
    let networkChangedCalled;

    describe('when navigator.connection.type is a string', () => {
      beforeEach(() => {
        networkChangedCalled = sinon.spy();
        networkMonitor = new NetworkMonitor(networkChangedCalled, { navigator: nav, window: win });
      });

      afterEach(() => {
        delete nav.connection.type;
      });

      it('should call the function when network has typechanged on navigator', () => {
        networkMonitor.start();
        nav.connection.type = 'bang';
        nav.connection.dispatchEvent({ type: 'typechange' });
        sinon.assert.calledOnce(networkChangedCalled);
      });

      it('should call the function when network has changed on navigator', () => {
        networkMonitor.start();
        nav.connection.type = 'foobar';
        nav.connection.dispatchEvent({ type: 'change' });
        sinon.assert.calledOnce(networkChangedCalled);
      });
    });

    describe('when navigator.connection.type is not available (rely on window.ononline)', () => {
      const navNoConnectionType = {
        connection: {}
      };

      beforeEach(() => {
        networkChangedCalled = sinon.spy();
        networkMonitor = new NetworkMonitor(networkChangedCalled, { navigator: navNoConnectionType, window: win });
      });

      it('should call the function on window', () => {
        networkMonitor.start();
        win.dispatchEvent({ type: 'online' });
        sinon.assert.calledOnce(networkChangedCalled);
      });
    });

    describe('when navigator.connection is not available (rely on window.ononline)', () => {
      beforeEach(() => {
        networkChangedCalled = sinon.spy();
        networkMonitor = new NetworkMonitor(networkChangedCalled, { navigator: {}, window: win });
      });

      it('should call the function when event is online on window', () => {
        networkMonitor.start();
        win.dispatchEvent({ type: 'online' });
        sinon.assert.calledOnce(networkChangedCalled);
      });
    });
  });
});
