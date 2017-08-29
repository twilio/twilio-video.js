'use strict';

const assert = require('assert');
const sinon = require('sinon');

const LocalDataStreamTrack = require('../../../../../lib/data/localdatastreamtrack');
const LocalDataTrack = require('../../../../../lib/media/track/localdatatrack');
const { randomName } = require('../../../../lib/util');

describe('LocalDataTrack', () => {
  let dataStreamTrack;
  let dataTrack;

  beforeEach(() => {
    dataTrack = new LocalDataTrack({
      LocalDataStreamTrack: function() {
        dataStreamTrack = new LocalDataStreamTrack();
        return dataStreamTrack;
      }
    });
  });

  describe('constructor', () => {
    it('returns an instance of LocalDataTrack', () => {
      assert(dataTrack instanceof LocalDataTrack);
    });

    it('constructs a new LocalDataStreamTrack', () => {
      assert(dataStreamTrack instanceof LocalDataStreamTrack);
    });

    it('sets .id to the LocalDataStreamTrack\'s ID', () => {
      assert.equal(dataTrack.id, dataStreamTrack.id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrack.kind, 'data');
    });
  });

  describe('#send', () => {
    let data;

    beforeEach(() => {
      data = randomName();
      dataStreamTrack.send = sinon.spy(dataStreamTrack.send.bind(dataStreamTrack));
      dataTrack.send(data);
    });

    it('calls #send on the underlying LocalDataStreamTrack', () => {
      sinon.assert.calledOnce(dataStreamTrack.send);
      sinon.assert.calledWith(dataStreamTrack.send, data);
    });
  });
});
