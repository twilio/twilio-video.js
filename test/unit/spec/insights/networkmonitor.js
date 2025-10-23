'use strict';

const assert = require('assert');
const sinon = require('sinon');
const NetworkMonitor = require('../../../../lib/insights/networkmonitor');
const telemetry = require('../../../../lib/insights/telemetry');

describe('NetworkMonitor', () => {
  let log;
  let networkMonitor;
  let mockConnection;
  let originalNavigator;
  let telemetrySpy;

  beforeEach(() => {
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

    telemetrySpy = sinon.spy(telemetry, 'info');
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
    telemetrySpy.restore();
  });

  describe('network information change handling', () => {
    it('should emit network-information-changed event with connection data', () => {
      networkMonitor = new NetworkMonitor(log);
      const changeHandler = mockConnection.addEventListener.getCall(0).args[1];
      telemetrySpy.resetHistory();

      changeHandler();

      sinon.assert.calledWith(telemetrySpy, {
        group: 'network',
        name: 'network-information-changed',
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
      networkMonitor = new NetworkMonitor(log);
      const changeHandler = mockConnection.addEventListener.getCall(0).args[1];
      telemetrySpy.resetHistory();

      changeHandler();

      const infoCall = telemetrySpy.getCall(0);
      assert.strictEqual(infoCall.args[0].payload.saveData, 'true');
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners', () => {
      networkMonitor = new NetworkMonitor(log);

      networkMonitor.cleanup();

      sinon.assert.calledTwice(mockConnection.removeEventListener);
      assert.strictEqual(networkMonitor._networkInformationHandler, null);
    });
  });
});
