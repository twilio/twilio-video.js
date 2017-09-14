'use strict';

const assert = require('assert');
const DataTrackTransceiver = require('../../../../lib/data/transceiver');
const { makeUUID } = require('../../../../lib/util');

describe('DataTrackTransceiver', () => {
  describe('constructor', () => {
    let id;
    let dataTrackTransceiver;

    beforeEach(() => {
      id = makeUUID();
      dataTrackTransceiver = new DataTrackTransceiver(id);
    });

    it('sets .id equal to the id passed into the constructor', () => {
      assert.equal(dataTrackTransceiver.id, id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrackTransceiver.kind, 'data');
    });
  });
});
