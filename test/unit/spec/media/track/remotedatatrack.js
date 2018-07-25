'use strict';

const assert = require('assert');
const DataTrackReceiver = require('../../../../../lib/data/receiver');
const EventTarget = require('../../../../../lib/eventtarget');
const RemoteDataTrack = require('../../../../../lib/media/track/remotedatatrack');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteDataTrack', () => {
  let dataTrackReceiver;

  beforeEach(() => {
    dataTrackReceiver = new DataTrackReceiver(makeDataChannel());
  });

  describe('constructor', () => {
    let dataTrack;

    beforeEach(() => {
      dataTrack = new RemoteDataTrack(dataTrackReceiver, { name: 'foo' });
    });

    it('returns an instance of RemoteDataTrack', () => {
      assert(dataTrack instanceof RemoteDataTrack);
    });

    it('sets .id to the DataTrackReceiver\'s ID', () => {
      assert.equal(dataTrack.id, dataTrackReceiver.id);
    });

    it('should set .isEnabled to true', () => {
      assert(dataTrack.isEnabled);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrack.kind, 'data');
    });

    it('sets .maxPacketLifeTime to the DataTrackReceiver\'s .maxPacketLifeTime', () => {
      assert.equal(dataTrack.maxPacketLifeTime, dataTrackReceiver.maxPacketLifeTime);
    });

    it('sets .maxRetransmits to the DataTrackReceiver\'s .maxRetransmits', () => {
      assert.equal(dataTrack.maxRetransmits, dataTrackReceiver.maxRetransmits);
    });

    it('sets .name to the value provided in options', () => {
      assert.equal(dataTrack.name, 'foo');
    });

    it('sets .ordered to the DataTrackReceiver\'s .ordered', () => {
      assert.equal(dataTrack.ordered, dataTrackReceiver.ordered);
    });
  });

  describe('"message" event, raised by the underlying DataTrackReceiver', () => {
    let dataTrack;
    let expectedData;

    beforeEach(() => {
      dataTrack = new RemoteDataTrack(dataTrackReceiver);
      expectedData = makeUUID();
    });

    it('re-emits the "message" event from the underlying DataTrackReceiver', () => {
      let actualData;
      dataTrack.on('message', data => { actualData = data; });
      dataTrackReceiver.emit('message', expectedData);
      assert.equal(actualData, expectedData);
    });
  });

  describe('Object.keys', () => {
    let track;

    before(() => {
      track = new RemoteDataTrack(dataTrackReceiver);
    });

    it('only returns public properties', () => {
      assert.deepEqual(Object.keys(track), [
        'id',
        'kind',
        'name',
        'isEnabled',
        'isSubscribed',
        'maxPacketLifeTime',
        'maxRetransmits',
        'ordered',
        'reliable',
        'sid'
      ]);
    });
  });

  describe('#toJSON', () => {
    let track;

    before(() => {
      track = new RemoteDataTrack(dataTrackReceiver);
    });

    it('only returns public properties', () => {
      assert.deepEqual(track.toJSON(), {
        id: track.id,
        isEnabled: track.isEnabled,
        isSubscribed: track.isSubscribed,
        kind: track.kind,
        maxPacketLifeTime: track.maxPacketLifeTime,
        maxRetransmits: track.maxRetransmits,
        name: track.name,
        ordered: track.ordered,
        reliable: track.reliable,
        sid: track.sid
      });
    });
  });
});

function makeDataChannel() {
  const dataChannel = new EventTarget();
  dataChannel.label = makeUUID();
  dataChannel.maxPacketLifeTime = Math.floor(Math.random() * 1000);
  dataChannel.maxRetransmits = Math.floor(Math.random() * 1000);
  dataChannel.ordered = Math.random() > 0.5;
  return dataChannel;
}
