'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const log = require('../../../../lib/fakelog');
const { waitForSometime } = require('../../../../../lib/util');

const TrackPrioritySignaling = require('../../../../../lib/signaling/v2/trackprioritysignaling');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = sinon.spy();
  return transport;
}

function makeTest(mst, setupTransport = true) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };

  const subject = new TrackPrioritySignaling(getReceiver, { log });
  if (setupTransport) {
    subject.setup('foo');
  }
  return subject;
}

describe('TrackPrioritySignaling', () => {
  describe('constructor', () => {
    it('should return a TrackPrioritySignaling', () => {
      const trackPrioritySignaling = makeTest(makeTransport());
      assert(trackPrioritySignaling instanceof TrackPrioritySignaling);
    });
  });

  describe('#sendTrackPriorityUpdates', () => {
    it('throws if updates are not for "subscribe" priority', () => {
      const mst = makeTransport();
      const trackPrioritySignaling = makeTest(mst);
      let error = null;
      try {
        trackPrioritySignaling.sendTrackPriorityUpdate('MT123', 'publish', 'bar');
      } catch (ex) {
        error = ex;
      }
      assert(error);
      assert(error.message === 'only subscribe priorities are supported, found: publish');
    });

    context('when the subscribe priority of a RemoteTrack is changed', () => {
      it('queues updates and publishes MSP payload when transport is ready ', async () => {
        const mst = makeTransport();
        const trackPrioritySignaling = makeTest(mst, false);
        trackPrioritySignaling.sendTrackPriorityUpdate('MT123', 'subscribe', 'bar');

        await waitForSometime(10);
        sinon.assert.callCount(mst.publish, 0);

        trackPrioritySignaling.setup('foo');
        await waitForSometime(10);

        sinon.assert.callCount(mst.publish, 1);
        sinon.assert.calledWith(mst.publish, {
          type: 'track_priority',
          track: 'MT123',
          subscribe: 'bar'
        });
      });
    });
  });
});

