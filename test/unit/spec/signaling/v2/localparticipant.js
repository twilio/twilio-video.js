'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const DataTrackSender = require('../../../../../lib/data/sender');
const EncodingParametersImpl = require('../../../../../lib/encodingparameters');
const LocalParticipantV2 = require('../../../../../lib/signaling/v2/localparticipant');
const TrackPrioritySignaling = require('../../../../../lib/signaling/v2/trackprioritysignaling');
const NetworkQualityConfigurationImpl = require('../../../../../lib/networkqualityconfiguration');
const { makeUUID } = require('../../../../../lib/util');

class MockLocalTrackPublicationV2 extends EventEmitter {
  constructor(trackSender, name, priority) {
    super();
    this.trackTransceiver = trackSender.clone();
    this.id = trackSender.id;
    this.isEnabled = true;
    this.name = name;
    this.priority = priority;
    this.updatedPriority = priority;
    this.sid = null;
    this.enable = enabled => { this.isEnabled = enabled; this.emit('updated'); };
    this.setPriority = priority => { this.updatedPriority = priority; this.emit('updated' ); };
    this.setSid = sid => { if (!this.sid) { this.sid = sid; this.emit('updated'); } };
    this.stop = () => this.trackTransceiver.stop();
  }
}

describe('LocalParticipantV2', () => {
  let LocalTrackPublicationV2Constructor;
  let localParticipant;
  let trackSender;
  let encodingParameters;
  let name;
  let networkQualityConfiguration;
  let priority;
  let publication;

  beforeEach(() => {
    LocalTrackPublicationV2Constructor = sinon.spy(function() {
      publication = new MockLocalTrackPublicationV2(...arguments);
      return publication;
    });

    encodingParameters = new EncodingParametersImpl();
    networkQualityConfiguration = new NetworkQualityConfigurationImpl();
    localParticipant = new LocalParticipantV2(encodingParameters, networkQualityConfiguration, {
      LocalTrackPublicationV2: LocalTrackPublicationV2Constructor
    });

    trackSender = new DataTrackSender();
    name = makeUUID();
    priority = makeUUID();
  });

  describe('constructor', () => {
    it('should set .networkQualityConfiguration', () => {
      assert.equal(localParticipant.networkQualityConfiguration, networkQualityConfiguration);
    });

    it('should set .revision', () => {
      assert.equal(localParticipant.revision, 1);
    });

    it('returns an instanceof LocalParticipantV2', () => {
      assert(localParticipant instanceof LocalParticipantV2);
    });
  });

  describe('#addTrack', () => {
    describe('called with a TrackSender, name and priority', () => {
      it('returns the LocalParticipantV2 instance', () => {
        assert.equal(localParticipant.addTrack(trackSender, name, priority), localParticipant);
      });

      it('constructs a LocalTrackPublicationV2 with the TrackSender, name and priority', () => {
        localParticipant.addTrack(trackSender, name, priority);
        sinon.assert.calledWith(LocalTrackPublicationV2Constructor, trackSender, name, priority);
      });

      it('adds the LocalTrackPublicationV2 to the LocalParticipantV2\'s .tracks Map', () => {
        localParticipant.addTrack(trackSender, name, priority);
        assert.equal(localParticipant.tracks.get(trackSender.id), publication);
      });

      it('emits "trackAdded", followed by "updated"', () => {
        const events = [];
        ['trackAdded', 'updated'].forEach(event =>
          localParticipant.once(event, () => events.push(event)));
        localParticipant.addTrack(trackSender, name, priority);
        assert.deepEqual(events, ['trackAdded', 'updated']);
      });

      describe('starts listening to the resulting LocalTrackPublicationV2\'s "updated" event and,', () => {
        beforeEach(() => {
          localParticipant.addTrack(trackSender, name, priority);
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
            publication.enable(!publication.isEnabled);
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
        localParticipant.addTrack(trackSender, name, priority);
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

      describe('and the sender is a MediaTrackSender', () => {
        it('calls .stop on the cloned MediaTrackSender', () => {
          // NOTE(mroberts): I'm cheating here. The `trackSender` shared by the
          // tests is a DataTrackSender, but we want to test that, when called
          // with a MediaTrackSender, which defines `stop`, `stop` is called.
          const publication = localParticipant.tracks.get(trackSender.id);
          publication.trackTransceiver.stop = sinon.spy();
          trackSender.stop = sinon.spy();

          try {
            localParticipant.removeTrack(trackSender);
            assert(publication.trackTransceiver.stop.calledOnce);
            assert(trackSender.stop.notCalled);
          } catch (error) {
            throw error;
          } finally {
            delete trackSender.stop;
          }
        });
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

  describe('#setNetworkQualityConfiguration', () => {
    it('should call .update on the underlying NetworkQualityConfigurationImpl', () => {
      localParticipant.setNetworkQualityConfiguration({ local: 3, remote: 1 });
      assert.equal(networkQualityConfiguration.local, 3);
      assert.equal(networkQualityConfiguration.remote, 1);
    });
  });

  describe('#setParameters', () => {
    it('should call .update on the underlying EncodingParametersImpl', () => {
      localParticipant.setParameters({ maxAudioBitrate: 100, maxVideoBitrate: 50 });
      assert.equal(encodingParameters.maxAudioBitrate, 100);
      assert.equal(encodingParameters.maxVideoBitrate, 50);
    });
  });

  describe('LocalTrackPublicationV2#updated', () => {
    let localTrackPublication;
    let revision;
    let trackPrioritySignaling;
    let updated;

    beforeEach(() => {
      localParticipant.addTrack(trackSender, name, priority);
      localTrackPublication = localParticipant.tracks.get(trackSender.id);
      revision = localParticipant.revision;
      trackPrioritySignaling = sinon.createStubInstance(TrackPrioritySignaling);
      localParticipant.setTrackPrioritySignaling(trackPrioritySignaling);
      localParticipant.once('updated', () => { updated = true; });
      updated = false;
    });

    [
      ['isEnabled', 'enable', false, true],
      ['updatedPriority', 'setPriority', makeUUID(), false],
      ['sid', 'setSid', makeUUID(), false]
    ].forEach(([prop, setProp, value, shouldEmitUpdated]) => {
      context(`when emitted due to a change in .${prop}`, () => {
        beforeEach(() => {
          localTrackPublication[setProp](value);
        });

        if (shouldEmitUpdated) {
          it('should increment .revision', () => {
            assert.equal(localParticipant.revision, revision + 1);
          });

          it('should emit "updated"', () => {
            assert(updated);
          });
        } else {
          it('should not increment .revision', () => {
            assert.equal(localParticipant.revision, revision);
          });

          it('should not emit "updated"', () => {
            assert(!updated);
          });

          if (prop === 'updatedPriority') {
            it('should call .sendTrackPriorityUpdate on the underlying TrackPrioritySignaling', () => {
              localTrackPublication.setSid('foo');
              sinon.assert.calledWith(trackPrioritySignaling.sendTrackPriorityUpdate, 'foo', 'publish', value);
            });
          }
        }
      });
    });
  });
});
