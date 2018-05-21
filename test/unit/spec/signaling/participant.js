'use strict';

const assert = require('assert');

const ParticipantSignaling = require('../../../../lib/signaling/participant');

describe('ParticipantSignaling', () => {
  describe('constructor', () => {
    let participant;

    beforeEach(() => {
      participant = new ParticipantSignaling();
    });

    it('sets .networkQualityLevels to null', () => {
      assert.equal(participant.networkQualityLevels, null);
    });
  });

  describe('setNetworkQualityLevels(networkQualityLevels)', () => {
    let participant;
    let expectedNetworkQualityLevels;

    beforeEach(() => {
      participant = new ParticipantSignaling();
      expectedNetworkQualityLevels = {};
    });

    it('sets .networkQualityLevels to networkQualityLevels', () => {
      participant.setNetworkQualityLevels(expectedNetworkQualityLevels);
      assert.equal(participant.networkQualityLevels, expectedNetworkQualityLevels);
    });

    it('emits "networkQualityLevelsChanged" with networkQualityLevels', () => {
      let actualNetworkQualityLevels;
      participant.once('networkQualityLevelsChanged', networkQualityLevels => { actualNetworkQualityLevels = networkQualityLevels; });
      participant.setNetworkQualityLevels(expectedNetworkQualityLevels);
      assert.equal(actualNetworkQualityLevels, expectedNetworkQualityLevels);
    });
  });
});
