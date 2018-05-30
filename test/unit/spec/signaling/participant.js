'use strict';

const assert = require('assert');

const ParticipantSignaling = require('../../../../lib/signaling/participant');

describe('ParticipantSignaling', () => {
  describe('constructor', () => {
    let participant;

    beforeEach(() => {
      participant = new ParticipantSignaling();
    });

    it('sets .networkQualityLevel to null', () => {
      assert.equal(participant.networkQualityLevel, null);
    });
  });

  describe('setNetworkQualityLevel(networkQualityLevel)', () => {
    let participant;
    let expectedNetworkQualityLevel;

    beforeEach(() => {
      participant = new ParticipantSignaling();
      expectedNetworkQualityLevel = 1;
    });

    it('sets .networkQualityLevel to networkQualityLevel', () => {
      participant.setNetworkQualityLevel(expectedNetworkQualityLevel);
      assert.equal(participant.networkQualityLevel, expectedNetworkQualityLevel);
    });

    it('emits "networkQualityLevelChanged"', () => {
      let didEmitEvent;
      participant.once('networkQualityLevelChanged', () => { didEmitEvent = true; });
      participant.setNetworkQualityLevel(expectedNetworkQualityLevel);
      assert(didEmitEvent);
    });
  });
});
