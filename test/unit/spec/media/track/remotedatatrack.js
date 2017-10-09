'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const DataTrackReceiver = require('../../../../../lib/data/receiver');
const EventTarget = require('../../../../../lib/eventtarget');
const RemoteDataTrack = require('../../../../../lib/media/track/remotedatatrack');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteDataTrack', () => {
  let dataTrackReceiver;
  let trackSignaling;
  let dataTrack;

  beforeEach(() => {
    dataTrackReceiver = new DataTrackReceiver(makeDataChannel());
  });

  describe('constructor, called with a RemoteTrackSignaling instance whose .isSubscribed property is', () => {
    [true, false].forEach(isSubscribed => {
      describe(isSubscribed.toString(), () => {
        let trackSignaling;
        let dataTrack;

        beforeEach(() => {
          trackSignaling = makeTrackSignaling(isSubscribed, makeUUID());
          dataTrack = new RemoteDataTrack(dataTrackReceiver, trackSignaling);
        });

        it('returns an instance of RemoteDataTrack', () => {
          assert(dataTrack instanceof RemoteDataTrack);
        });

        it('sets .id to the DataTrackReceiver\'s ID', () => {
          assert.equal(dataTrack.id, dataTrackReceiver.id);
        });

        it(`sets .isSubscribed to ${isSubscribed}`, () => {
          assert.equal(dataTrack.isSubscribed, isSubscribed);
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

        it('sets .name to the RemoteTrackSignaling\'s .name', () => {
          assert.equal(dataTrack.name, trackSignaling.name);
        });

        it('sets .ordered to the DataTrackReceiver\'s .ordered', () => {
          assert.equal(dataTrack.ordered, dataTrackReceiver.ordered);
        });

        it('sets .sid to the RemoteTrackSignaling\'s SID', () => {
          assert.equal(dataTrack.sid, trackSignaling.sid);
        });
      });
    });
  });

  describe('"message" event, raised by the underlying DataTrackReceiver, when the TrackSignaling\'s .isSubscribed property is', () => {
    [true, false].forEach(isSubscribed => {
      describe(isSubscribed.toString(), () => {
        let trackSignaling;
        let dataTrack;
        let expectedData;

        beforeEach(() => {
          trackSignaling = makeTrackSignaling(isSubscribed, makeUUID());
          dataTrack = new RemoteDataTrack(dataTrackReceiver, trackSignaling);
          expectedData = makeUUID();
        });

        it('re-emits the "message" event from the underlying DataTrackReceiver', () => {
          let actualData;
          dataTrack.on('message', data => actualData = data);
          dataTrackReceiver.emit('message', expectedData);
          assert.equal(actualData, expectedData);
        });
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

function makeTrackSignaling(isSubscribed, sid) {
  const signaling = new EventEmitter();
  signaling.isSubscribed = isSubscribed;
  signaling.name = makeUUID();
  signaling.sid = sid;
  return signaling;
}
