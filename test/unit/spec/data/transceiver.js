'use strict';

const assert = require('assert');
const DataTrackTransceiver = require('../../../../lib/data/transceiver');
const { makeUUID } = require('../../../../lib/util');

describe('DataTrackTransceiver', () => {
  describe('constructor', () => {
    let id;
    let maxPacketLifeTime;
    let maxRetransmits;
    let ordered;
    let dataTrackTransceiver;

    beforeEach(() => {
      id = makeUUID();
      maxPacketLifeTime = Math.floor(Math.random() * 1000);
      maxRetransmits = Math.floor(Math.random() * 1000);
      ordered = Math.random() > 0.5;
      dataTrackTransceiver = new DataTrackTransceiver(
        id,
        maxPacketLifeTime,
        maxRetransmits,
        ordered);
    });

    it('sets .id equal to the id passed into the constructor', () => {
      assert.equal(dataTrackTransceiver.id, id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrackTransceiver.kind, 'data');
    });

    it('sets .maxPacketLifeTime to the value passed into the constructor', () => {
      assert.equal(dataTrackTransceiver.maxPacketLifeTime, maxPacketLifeTime);
    });

    it('sets .maxRetransmits to the value passed into the constructor', () => {
      assert.equal(dataTrackTransceiver.maxRetransmits, maxRetransmits);
    });

    it('sets .ordered to the value passed into the constructor', () => {
      assert.equal(dataTrackTransceiver.ordered, ordered);
    });
  });
});
