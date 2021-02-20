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

function makeTest(mst) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };

  const subject = new TrackPrioritySignaling(getReceiver, { log });
  subject.setup('foo');
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
    context('when the subscribe priority of a RemoteTrack is changed', () => {
      it('should call the underlying MediaSignalingTransport\'s .publish with the MSP payload\'s subscribe property set to the new priority', async () => {
        const mst = makeTransport();
        const trackPrioritySignaling = makeTest(mst);
        await waitForSometime(10);
        trackPrioritySignaling.sendTrackPriorityUpdate('MT123', 'subscribe', 'bar');
        sinon.assert.calledWith(mst.publish, {
          type: 'track_priority',
          track: 'MT123',
          subscribe: 'bar'
        });
      });
    });
  });
});
