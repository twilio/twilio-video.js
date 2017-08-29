'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const RemoteDataStreamTrack = require('../../../../../lib/data/remotedatastreamtrack');
const EventTarget = require('../../../../../lib/eventtarget');
const RemoteDataTrack = require('../../../../../lib/media/track/remotedatatrack');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteDataTrack', () => {
  let dataStreamTrack;
  let trackSignaling;
  let dataTrack;

  beforeEach(() => {
    dataStreamTrack = new RemoteDataStreamTrack(makeDataChannel());
  });

  describe('constructor, called with a RemoteTrackSignaling instance whose .isSubscribed property is', () => {
    [true, false].forEach(isSubscribed => {
      describe(isSubscribed.toString(), () => {
        let trackSignaling;
        let dataTrack;

        beforeEach(() => {
          trackSignaling = makeTrackSignaling(isSubscribed, makeUUID());
          dataTrack = new RemoteDataTrack(dataStreamTrack, trackSignaling);
        });

        it('returns an instance of RemoteDataTrack', () => {
          assert(dataTrack instanceof RemoteDataTrack);
        });

        it('sets .id to the RemoteDataStreamTrack\'s ID', () => {
          assert.equal(dataTrack.id, dataStreamTrack.id);
        });

        it(`sets .isSubscribed to ${isSubscribed}`, () => {
          assert.equal(dataTrack.isSubscribed, isSubscribed);
        });

        it('sets .kind to "data"', () => {
          assert.equal(dataTrack.kind, 'data');
        });

        it('sets .sid to the RemoteTrackSignaling\'s SID', () => {
          assert.equal(dataTrack.sid, trackSignaling.sid);
        });
      });
    });
  });

  describe('"message" event, raised by the underlying RemoteDataStreamTrack, when the TrackSignaling\'s .isSubscribed property is', () => {
    [true, false].forEach(isSubscribed => {
      describe(isSubscribed.toString(), () => {
        let trackSignaling;
        let dataTrack;
        let expectedData;

        beforeEach(() => {
          trackSignaling = makeTrackSignaling(isSubscribed, makeUUID());
          dataTrack = new RemoteDataTrack(dataStreamTrack, trackSignaling);
          expectedData = makeUUID();
        });

        it('re-emits the "message" event from the underlying RemoteDataStreamTrack', () => {
          let actualData;
          dataTrack.on('message', data => actualData = data);
          dataStreamTrack.emit('message', expectedData);
          assert.equal(actualData, expectedData);
        });
      });
    });
  });
});

function makeDataChannel() {
  const dataChannel = new EventTarget();
  dataChannel.label = makeUUID();
  return dataChannel;
}

function makeTrackSignaling(isSubscribed, sid) {
  const signaling = new EventEmitter();
  signaling.isSubscribed = isSubscribed;
  signaling.sid = sid;
  return signaling;
}
