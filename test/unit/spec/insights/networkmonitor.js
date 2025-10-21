'use strict';

const assert = require('assert');
const sinon = require('sinon');
const NetworkMonitor = require('../../../../lib/insights/networkmonitor');

describe('NetworkMonitor', () => {
  let eventObserver;
  let log;
  let networkMonitor;
  let mockConnection;
  let originalNavigator;

  beforeEach(() => {
    eventObserver = {
      emit: sinon.spy()
    };

    log = {
      debug: sinon.spy(),
      error: sinon.spy()
    };

    mockConnection = {
      downlink: 10,
      downlinkMax: 20,
      effectiveType: '4g',
      rtt: 50,
      saveData: false,
      type: 'wifi',
      addEventListener: sinon.spy(),
      removeEventListener: sinon.spy()
    };

    originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: { connection: mockConnection },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    if (networkMonitor) {
      networkMonitor.cleanup();
      networkMonitor = null;
    }
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  describe('network information change handling', () => {
    it('should emit network-information-changed event with connection data', () => {
      networkMonitor = new NetworkMonitor(eventObserver, log);
      const changeHandler = mockConnection.addEventListener.getCall(0).args[1];
      eventObserver.emit.resetHistory();

      changeHandler();

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'network',
        name: 'network-information-changed',
        level: 'info',
        payload: {
          downlink: 10,
          downlinkMax: 20,
          effectiveType: '4g',
          rtt: 50,
          saveData: 'false',
          type: 'wifi'
        }
      });
    });

    it('should convert boolean saveData to string', () => {
      mockConnection.saveData = true;
      networkMonitor = new NetworkMonitor(eventObserver, log);
      const changeHandler = mockConnection.addEventListener.getCall(0).args[1];
      eventObserver.emit.resetHistory();

      changeHandler();

      const emitCall = eventObserver.emit.getCall(0);
      assert.strictEqual(emitCall.args[1].payload.saveData, 'true');
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners', () => {
      networkMonitor = new NetworkMonitor(eventObserver, log);

      networkMonitor.cleanup();

      sinon.assert.calledTwice(mockConnection.removeEventListener);
      assert.strictEqual(networkMonitor._networkInformationHandler, null);
    });
  });
});
