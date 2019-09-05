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
      dataTrack = new RemoteDataTrack('foo', dataTrackReceiver, { name: 'foo' });
    });

    it('returns an instance of RemoteDataTrack', () => {
      assert(dataTrack instanceof RemoteDataTrack);
    });

    it('sets .sid', () => {
      assert.equal(dataTrack.sid, 'foo');
    });

    it('should set .isEnabled to true', () => {
      assert.equal(dataTrack.isEnabled, true);
    });

    it('should set .isSwitchedOff to false', () => {
      assert.equal(dataTrack.isSwitchedOff, false);
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

  describe('#_setSwitchedOff', () => {
    [
      [true, true],
      [true, false],
      [false, true],
      [false, false]
    ].forEach(([isSwitchedOff, newIsSwitchedOff]) => {
      context(`when .isSwitchedOff is ${isSwitchedOff} and the new value is ${newIsSwitchedOff}`, () => {
        let arg;
        let track;
        let trackSwitchedOff;
        let trackSwitchedOn;

        beforeEach(() => {
          arg = null;
          track = new RemoteDataTrack('foo', dataTrackReceiver);
          if (isSwitchedOff) {
            track._setSwitchedOff(isSwitchedOff);
          }
          track.once('switchedOff', _arg => {
            trackSwitchedOff = true;
            arg = _arg;
          });
          track.once('switchedOn', _arg => {
            trackSwitchedOn = true;
            arg = _arg;
          });
          track._setSwitchedOff(newIsSwitchedOff);
        });

        if (isSwitchedOff === newIsSwitchedOff) {
          it('should not change the .isSwitchedOff property', () => {
            assert.equal(track.isSwitchedOff, isSwitchedOff);
          });

          it('should not emit any events', () => {
            assert(!trackSwitchedOff);
            assert(!trackSwitchedOn);
          });

          return;
        }

        it(`should set .isSwitchedOff to ${newIsSwitchedOff}`, () => {
          assert.equal(track.isSwitchedOff, newIsSwitchedOff);
        });

        it(`should emit "${newIsSwitchedOff ? 'switchedOff' : 'switchedOn'}" on the RemoteDatatrack with the RemoteDatatrack itself`, () => {
          assert(newIsSwitchedOff ? trackSwitchedOff : trackSwitchedOn);
          assert(!(newIsSwitchedOff ? trackSwitchedOn : trackSwitchedOff));
          assert.equal(arg, track);
        });
      });
    });
  });

  describe('"message" event, raised by the underlying DataTrackReceiver', () => {
    let dataTrack;
    let expectedData;

    beforeEach(() => {
      dataTrack = new RemoteDataTrack('foo', dataTrackReceiver);
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
      track = new RemoteDataTrack('MT1', dataTrackReceiver);
    });

    it('only returns public properties', () => {
      assert.deepEqual(Object.keys(track), [
        'kind',
        'name',
        'isEnabled',
        'isSwitchedOff',
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
      track = new RemoteDataTrack('MT1', dataTrackReceiver);
    });

    it('only returns public properties', () => {
      assert.deepEqual(track.toJSON(), {
        isEnabled: track.isEnabled,
        isSwitchedOff: track.isSwitchedOff,
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
