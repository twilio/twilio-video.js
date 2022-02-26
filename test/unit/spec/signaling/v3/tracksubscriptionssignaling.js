'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const TrackSubscriptionsSignaling = require('../../../../../lib/signaling/v3/tracksubscriptionssignaling');
const { waitForSometime } = require('../../../../../lib/util');
const log = require('../../../../lib/fakelog');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = () => {};
  return transport;
}

function makeTest(mst) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };
  const subject = new TrackSubscriptionsSignaling(getReceiver, { log });
  subject.setup('foo');
  return subject;
}

describe('TrackSubscriptionsSignaling', () => {
  describe('constructor', () => {
    it('sets .channel to "track_subscriptions"', () => {
      const subject = makeTest(makeTransport());
      assert.strictEqual(subject.channel, 'track_subscriptions');
    });

    it('initializes ._currentRevision to 0', () => {
      const subject = makeTest(makeTransport());
      assert.strictEqual(subject._currentRevision, 0);
    });
  });

  describe('when mediaSignalingTransport emits a "message" event', () => {
    [-1, 0, 1].forEach(revision => {
      describe(`and the message's .revision is ${revision === -1 ? 'less than' : revision === 0 ? 'equal to' : 'greater than'} ._currentRevision`, () => {
        const message = {
          errors: {
            MTaaa: { code: 100, message: 'bar' },
            MTbbb: { code: 200, message: 'baz' }
          },
          revision,
          subscribed: {
            MTxxx: { mid: '0', state: 'ON' },
            // eslint-disable-next-line camelcase
            MTyyy: { off_reason: 'zee', state: 'OFF' }
          },
          type: 'track_subscriptions'
        };
        let mediaSignalingTransport;
        let subject;
        let updatedArgs;

        beforeEach(async () => {
          mediaSignalingTransport = makeTransport();
          subject = makeTest(mediaSignalingTransport);
          await waitForSometime(10);
          subject.once('updated',  (...args) => { updatedArgs = args; });
          mediaSignalingTransport.emit('message', message);
        });

        if (revision === 1) {
          it('should emit "updated"', () => {
            const [subscribed, errors] = updatedArgs;
            assert.deepStrictEqual(subscribed, {
              MTxxx: { mid: '0', state: 'ON' },
              // eslint-disable-next-line camelcase
              MTyyy: { off_reason: 'zee', state: 'OFF' }
            });
            assert.deepStrictEqual(errors, {
              MTaaa: { code: 100, message: 'bar' },
              MTbbb: { code: 200, message: 'baz' }
            });
          });
        } else {
          it('should not emit "updated"', () => {
            assert(!updatedArgs);
          });
        }
      });
    });
  });
});
