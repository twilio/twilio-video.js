'use strict';

const assert = require('assert');
const DataStreamTrack = require('../../../../lib/data/datastreamtrack');
const { makeUUID } = require('../../../../lib/util');

describe('DataStreamTrack', () => {
  describe('constructor', () => {
    let id;
    let dataStreamTrack;

    beforeEach(() => {
      id = makeUUID();
      dataStreamTrack = new DataStreamTrack(id);
    });

    it('sets .id equal to the id passed into the constructor', () => {
      assert.equal(dataStreamTrack.id, id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataStreamTrack.kind, 'data');
    });
  });
});
