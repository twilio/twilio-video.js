'use strict';

const assert = require('assert');
const sinon = require('sinon');

const DataTrackSender = require('../../../../../lib/data/sender');
const LocalDataTrack = require('../../../../../lib/media/track/localdatatrack');
const { randomName } = require('../../../../lib/util');

describe('LocalDataTrack', () => {
  let dataTrackSender;
  let dataTrack;

  beforeEach(() => {
    dataTrack = new LocalDataTrack({
      DataTrackSender: function() {
        dataTrackSender = new DataTrackSender();
        return dataTrackSender;
      }
    });
  });

  describe('constructor', () => {
    it('returns an instance of LocalDataTrack', () => {
      assert(dataTrack instanceof LocalDataTrack);
    });

    it('constructs a new DataTrackSender', () => {
      assert(dataTrackSender instanceof DataTrackSender);
    });

    it('sets .id to the DataTrackSender\'s ID', () => {
      assert.equal(dataTrack.id, dataTrackSender.id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrack.kind, 'data');
    });
  });

  describe('#send', () => {
    let data;

    beforeEach(() => {
      data = randomName();
      dataTrackSender.send = sinon.spy(dataTrackSender.send.bind(dataTrackSender));
      dataTrack.send(data);
    });

    it('calls #send on the underlying DataTrackSender', () => {
      sinon.assert.calledOnce(dataTrackSender.send);
      sinon.assert.calledWith(dataTrackSender.send, data);
    });
  });
});
