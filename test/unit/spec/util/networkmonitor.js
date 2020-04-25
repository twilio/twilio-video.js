'use strict';

const assert = require('assert');
const sinon = require('sinon');

const MockConnection = require('../../../lib/mockconnection');
const EventTarget = require('../../../../lib/eventtarget');
const { combinationContext } = require('../../../lib/util');

const NetworkMonitor = require('../../../../lib/util/networkmonitor');

describe('NetworkMonitor', () => {
  describe('constructor', () => {
    it('should return an instance of NetworkMonitor', () => {
      const networkMonitor = new NetworkMonitor(() => {
      });
      assert(networkMonitor instanceof NetworkMonitor);
    });

    [undefined, false, true].forEach(onLine => {
      const expectedIsOnline = typeof onLine === 'boolean' ? onLine : true;
      const navigator = typeof onLine === 'boolean' ? { onLine } : {};
      context(`when navigator.onLine is ${typeof onLine === 'boolean' ? onLine : 'not present'}`, () => {
        it(`should set .isOnline to ${expectedIsOnline}`, () => {
          const networkMonitor = new NetworkMonitor(() => {
          }, { navigator });
          assert.equal(networkMonitor.isOnline, expectedIsOnline);
        });
      });
    });

    [undefined, new MockConnection(), new MockConnection('whiz')].forEach(connection => {
      const expectedType = connection && connection.type ? connection.type : null;
      const navigator = connection ? { connection } : {};
      context(`when navigator.connection${connection ? `.type ${connection.type ? 'exists' : 'does not exist'}` : ' does not exist'}`, () => {
        it(`should set .type to ${expectedType}`, () => {
          const networkMonitor = new NetworkMonitor(() => {
          }, { navigator });
          assert.equal(networkMonitor.type, expectedType);
        });
      });
    });
  });

  describe('#start', () => testStartOrStop('start'));

  describe('#stop', () => testStartOrStop('stop'));

  describe('onNetworkChanged', () => {
    combinationContext([
      [
        [undefined, new MockConnection(), new MockConnection('whiz'), new MockConnection('change'), new MockConnection('typechange')],
        x => `when navigator.connection${x ? `.type ${{
          whiz: 'does not change',
          change: 'changes with "change" event',
          typechange: 'changes with "typechange" event'
        }[x.type] || 'does not exist'}` : ' does not exist'}`
      ],
      [
        [true, false],
        onLine => `when navigator.onLine changes from ${onLine} to ${!onLine}`
      ]
    ], ([connection, onLine]) => {
      const shouldCallNetworkChanged = !(onLine || (connection && connection.type && connection.type === 'whiz'));
      it(`should ${shouldCallNetworkChanged ? '' : 'not '}call onNetworkChanged`, () => {
        const navigator = {
          connection,
          onLine
        };
        const onNetworkChanged = sinon.spy();
        const window = new EventTarget();
        const networkMonitor = new NetworkMonitor(onNetworkChanged, {
          navigator,
          window
        });
        networkMonitor.start();
        navigator.onLine = !onLine;
        window.dispatchEvent({ type: navigator.onLine ? 'online' : 'offline' });
        if (connection && connection.type && connection.type !== 'whiz') {
          const type = connection.type;
          connection.type = 'bang';
          connection.dispatchEvent({ type });
          connection.type = type;
        }
        sinon.assert.callCount(onNetworkChanged, shouldCallNetworkChanged ? 1 : 0);
      });
    });
  });
});

/**
 * Test the {@link NetworkMonitor}'s #start() or #stop() methods.
 * @param method - 'start' | 'stop'
 */
function testStartOrStop(method) {
  const eventTargetMethod = {
    start: 'addEventListener',
    stop: 'removeEventListener'
  }[method];

  [undefined, new MockConnection(), new MockConnection('whiz')].forEach(connection => {
    const events = connection && connection.type ? ['change', 'typechange'] : ['online'];
    const navigator = connection ? { connection } : {};
    const window = new EventTarget();
    const target = connection && connection.type ? connection : window;

    context(`when navigator.connection${connection ? `.type ${connection.type ? 'exists' : 'does not exist'}` : ' does not exist'}`, () => {
      it(`should ${method === 'start' ? 'listen' : 'stop listening'} to ${events.map(event => `"${event}"`).join(', ')} events on ${target === connection ? 'connection' : 'window'}`, () => {
        const networkMonitor = new NetworkMonitor(() => {}, { navigator, window });
        target[eventTargetMethod] = sinon.spy();
        networkMonitor[method]();
        events.forEach((event, i) => assert.equal(target[eventTargetMethod].args[i][0], event));
      });
    });
  });
}
