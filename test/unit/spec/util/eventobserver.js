const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const EventObserver = require('../../../../lib/util/eventobserver');
const log = require('../../../lib/fakelog');

function makePublisher() {
  return {
    publish: sinon.spy()
  };
}
describe('EventObserver', () => {
  describe('constructor', () => {
    it('should return an EventObserver', () => {
      assert(new EventObserver(makePublisher(), 0, log, new EventEmitter()) instanceof EventObserver);
    });
  });

  describe('"event", when emitted', () => {
    [
      { reason: 'bad_group', group: 'bad_group', level: 'info' },
      { reason: 'bad_level', name: 'foo', group: 'signaling', level: 'bad_level' },
      { reason: 'missing_level', name: 'foo', group: 'signaling' },
      { reason: 'missing_group', name: 'foo', level: 'info' },
      { reason: 'missing_name', level: 'info', group: 'signaling' },
      { name: 'level_info', level: 'info', group: 'signaling' },
      { name: 'level_warning', level: 'warning', group: 'signaling' },
      { name: 'level_error', level: 'error', group: 'signaling' },
      { name: 'level_debug', level: 'debug', group: 'signaling' }
    ].forEach(params => {
      let reason = params.reason;
      let connectTimestamp;
      let eventParams;
      let eventObserver;

      before(() => {
        delete params.reason;
        connectTimestamp = Date.now();
        const eventListener = new EventEmitter();
        eventObserver = new EventObserver(makePublisher(), connectTimestamp, log, eventListener);
        eventListener.once('event', event => { eventParams = event; });
      });

      if (params.reason) {
        it('throws for bad event params : ' + reason, () => {
          assert.throws(() => {
            eventObserver.emit('event', params);
          });
        });
      } else {
        it(' does not throw for: ' + params.name, () => {
          assert.doesNotThrow(() => {
            eventObserver.emit('event', params);
          });
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

        it(`.level set to "${params.level}"`, () => {
          assert.equal(eventParams.level, params.level);
        });

        it(`.name set to "${params.name}"`, () => {
          assert.equal(eventParams.name, params.name);
        });

        it('.payload set to the given payload', () => {
          assert.deepEqual(eventParams.payload, params.payload);
        });
      }
    });
  });
});
