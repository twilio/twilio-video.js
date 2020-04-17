'use strict';

const assert = require('assert');
const sinon = require('sinon');

const NetworkMonitor = require('../../../../lib/util/networkmonitor');

describe.only('networkMonitor', () => {
  const onNetworkChangedCalled = sinon.spy();

  it('should return an instance of NetworkMonitor', () => {
    const networkMonitor = new NetworkMonitor();
    assert(networkMonitor instanceof NetworkMonitor);
  });

  [true, false].forEach(bool => {
    it(`should return ${bool} when accessing isOnline`, () => {
      navigator.onLine = bool;
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator });
      assert.equal(networkMonitor.isOnline, bool);
    });
  });

  [{ connection: { type: 'wifi' } }, { connection: '' }, {}].forEach(el => {
    it(`should return ${(el.connection && el.connection.type) || null}`, () => {
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator: el });

      if (el.connection && el.connection.type) {
        assert.equal(networkMonitor.type, el.connection.type);
      } else {
        assert.equal(networkMonitor.type, null);
      }
    });
  });
});
