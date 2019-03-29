'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const DataTrackSender = require('../../../../../lib/data/sender');
const EncodingParameters = require('../../../../../lib/encodingparameters');
const LocalParticipantV2 = require('../../../../../lib/signaling/v2/localparticipant');
const NetworkQualityConfiguration = require('../../../../../lib/networkqualityconfiguration');

class MockLocalTrackPublicationV2 extends EventEmitter {
  constructor(trackSender, name) {
    super();
    this.trackSender = trackSender;
    this.id = trackSender.id;
    this.name = name;
    this.sid = null;
  }
}

describe('LocalParticipantV2', () => {
  let LocalTrackPublicationV2Constructor;
  let localParticipant;
  let trackSender;
  let name;
  let publication;

  beforeEach(() => {
    LocalTrackPublicationV2Constructor = sinon.spy(function() {
      publication = new MockLocalTrackPublicationV2(...arguments);
      return publication;
    });

    localParticipant = new LocalParticipantV2(new EncodingParameters(), new NetworkQualityConfiguration(), {
      LocalTrackPublicationV2: LocalTrackPublicationV2Constructor
    });

    trackSender = new DataTrackSender();

    name = `track-${Math.random() * 1000}`;
  });

  describe('constructor', () => {
    it('returns an instanceof LocalParticipantV2', () => {
      assert(localParticipant instanceof LocalParticipantV2);
    });
  });

  describe('#addTrack', () => {
    describe('called with a TrackSender and a name', () => {
      it('returns the LocalParticipantV2 instance', () => {
        assert.equal(localParticipant.addTrack(trackSender, name), localParticipant);
      });

      it('constructs a LocalTrackPublicationV2 with the TrackSender and name', () => {
        localParticipant.addTrack(trackSender, name);
        sinon.assert.calledWith(LocalTrackPublicationV2Constructor, trackSender, name);
      });

      it('adds the LocalTrackPublicationV2 to the LocalParticipantV2\'s .tracks Map', () => {
        localParticipant.addTrack(trackSender, name);
        assert.equal(localParticipant.tracks.get(trackSender.id), publication);
      });

      it('emits "trackAdded", followed by "updated"', () => {
        const events = [];
        ['trackAdded', 'updated'].forEach(event =>
          localParticipant.once(event, () => events.push(event)));
        localParticipant.addTrack(trackSender, name);
        assert.deepEqual(events, ['trackAdded', 'updated']);
      });

      describe('starts listening to the resulting LocalTrackPublicationV2\'s "updated" event and,', () => {
        beforeEach(() => {
          localParticipant.addTrack(trackSender, name);
        });

        describe('when the LocalTrackPublicationV2\'s SID is set,', () => {
          // FIXME(mroberts): This might be the source of our problems.
          it('does not emit "updated"', () => {
            let didEmitUpdated = false;
            localParticipant.once('updated', () => { didEmitUpdated = true; });
            publication.sid = 'MT123';
            publication.emit('updated');
            assert(!didEmitUpdated);
          });
        });

        describe('when the LocalTrackPublicationV2 is enabled or disabled,', () => {
          it('emits "updated"', () => {
            publication.sid = 'MT123';
            publication.emit('updated');

            let didEmitUpdated = false;
            localParticipant.once('updated', () => { didEmitUpdated = true; });
            publication.emit('updated');
            assert(didEmitUpdated);
          });
        });
      });
    });
  });

  describe('#removeTrack, called with a DataTrackSedner or MediaTrackSender that is', () => {
    describe('currently added', () => {
      beforeEach(() => {
        localParticipant.addTrack(trackSender, name);
        publication.sid = 'MT123';
        publication.emit('updated');
      });

      it('returns true', () => {
        assert(localParticipant.removeTrack(trackSender));
      });

      it('removes the LocalTrackPublicationV2 from the LocalParticipantV2\'s .tracks Map', () => {
        localParticipant.removeTrack(trackSender);
        assert(!localParticipant.tracks.has(trackSender.id));
      });

      it('emits "trackRemoved", followed by "updated"', () => {
        const events = [];
        ['trackRemoved', 'updated'].forEach(event =>
          localParticipant.once(event, () => events.push(event)));
        localParticipant.removeTrack(trackSender);
        assert.deepEqual(events, ['trackRemoved', 'updated']);
      });

      it('stops listening to the LocalTrackPublicationV2\'s "updated" event', () => {
        localParticipant.removeTrack(trackSender);

        let didEmitUpdated = false;
        localParticipant.once('updated', () => { didEmitUpdated = true; });
        publication.emit('updated');
        assert(!didEmitUpdated);
      });
    });

    describe('not currently added', () => {
      it('returns false', () => {
        assert(!localParticipant.removeTrack(trackSender));
      });

      it('does not emit "trackRemoved" or "updated"', () => {
        const events = [];
        ['trackRemoved', 'updated'].forEach(event =>
          localParticipant.once(event, () => events.push(event)));
        localParticipant.removeTrack(trackSender);
        assert.deepEqual(events, []);
      });
    });
  });
});
