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
    it(`should be ${bool} when accessing isOnline`, () => {
      navigator.onLine = bool;
      const networkMonitor = new NetworkMonitor(onNetworkChangedCalled, { navigator });
      assert.equal(networkMonitor.isOnline, bool);
    });
  });

  // ['bluetooth', 'cellular', 'ethernet', 'none', 'wifi', 'wimax', 'other', 'unknown']

});
