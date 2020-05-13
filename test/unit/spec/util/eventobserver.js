const assert = require('assert');
const { EventEmitter } = require('events');
const EventObserver = require('../../../../lib/util/eventobserver');

describe('EventObserver', () => {
  describe('constructor', () => {
    it('should return an EventObserver', () => {
      assert(new EventObserver(0, new EventEmitter()) instanceof EventObserver);
    });
  });

  describe('"event", when emitted', () => {
    [
      ['closed', 'error', { reason: 'failed' }],
      ['closed', 'info', { reason: 'local' }],
      ['connecting', 'info'],
      ['early', 'info'],
      ['open', 'info'],
      ['wait', 'warning']
    ].forEach(([name, level, payload]) => {
      context(`with .name "${name}"${payload ? ' and a .payload' : ''}, should emit an "event" on the EventListener with`, () => {
        let connectTimestamp;
        let eventParams;

        before(() => {
          connectTimestamp = Date.now();
          const eventListener = new EventEmitter();
          const eventObserver = new EventObserver(connectTimestamp, eventListener);
          eventListener.once('event', event => { eventParams = event; });
          eventObserver.emit('event', payload ? { name, payload } : { name });
        });

        it('.timestamp', () => {
          assert.equal(typeof eventParams.timestamp, 'number');
        });

        it('.elapsedTime', () => {
          assert.equal(eventParams.elapsedTime, eventParams.timestamp - connectTimestamp);
        });

        it('.group set to "signaling"', () => {
          assert.equal(eventParams.group, 'signaling');
        });

        it(`.level set to "${level}"`, () => {
          assert.equal(eventParams.level, level);
        });

        it(`.name set to "${name}"`, () => {
          assert.equal(eventParams.name, name);
        });

        it('.payload set to the given payload', () => {
          assert.deepEqual(eventParams.payload, payload);
        });
      });
    });
  });
});
