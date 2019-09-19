'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { EventEmitter } = require('events');
const MediaSignalingTransport = require('../../../../../lib/data/transport');
const TrackPrioritySignaling = require('../../../../../lib/signaling/v2/trackprioritysignaling');

describe('TrackPrioritySignaling', () => {
  describe('constructor', () => {
    it('should return a TrackPrioritySignaling', () => {
      const mediaSignalingTransport = sinon.createStubInstance(MediaSignalingTransport);
      const trackPrioritySignaling = new TrackPrioritySignaling(mediaSignalingTransport);
      assert(trackPrioritySignaling instanceof TrackPrioritySignaling);
    });
  });

  describe('#sendTrackPriorityUpdates', () => {
    ['publish', 'subscribe'].forEach(action => {
      context(`when the ${action} priority of a ${{ publish: 'Local', subscribe: 'Remote' }[action]}Track is changed`, () => {
        it(`should call the underlying MediaSignalingTransport's .publish with the MSP payload's .${action} property set to the new priority`, () => {
          const mediaSignalingTransport = sinon.createStubInstance(MediaSignalingTransport);
          const trackPrioritySignaling = new TrackPrioritySignaling(mediaSignalingTransport);
          trackPrioritySignaling.sendTrackPriorityUpdate('MT123', action, 'bar');
          sinon.assert.calledWith(mediaSignalingTransport.publish, {
            type: 'track_priority',
            track: 'MT123',
            [action]: 'bar'
          });
        });
      });
    });
  });

  describe('"updated" event', () => {
    ['publish', 'subscribe'].forEach(action => {
      context(`when the underlying MediaSignalingTransport emits a "message" event with an MSP payload with a .${action} property`, () => {
        it(`should emit an "updated" event with the Track SID, "${action}" and the new priority`, async () => {
          const mediaSignalingTransport = new EventEmitter();
          const trackPrioritySignaling = new TrackPrioritySignaling(mediaSignalingTransport);
          const updatedPromise = new Promise(resolve => trackPrioritySignaling.once('updated', (trackSid, publishOrSubscribe, priority) => resolve({
            trackSid,
            publishOrSubscribe,
            priority
          })));

          mediaSignalingTransport.emit('message', {
            type: 'track_priority',
            track: 'MT123',
            [action]: 'bar'
          });

          const { trackSid, publishOrSubscribe, priority } = await updatedPromise;
          assert.equal(trackSid, 'MT123');
          assert.equal(publishOrSubscribe, action);
          assert.equal(priority, 'bar');
        });
      });
    });
  });
});
