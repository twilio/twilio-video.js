'use strict';

const assert = require('assert');
const sinon = require('sinon');

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
});
