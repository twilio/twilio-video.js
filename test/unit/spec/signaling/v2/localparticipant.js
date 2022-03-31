'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const DataTrackSender = require('../../../../../lib/data/sender');
const EncodingParametersImpl = require('../../../../../lib/encodingparameters');
const LocalParticipantV2 = require('../../../../../lib/signaling/v2/localparticipant');
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
    this.setPriority = priority => { this.updatedPriority = priority; this.emit('updated'); };
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
    it('should set .bandwidthProfile to null', () => {
      assert.equal(localParticipant.bandwidthProfile, null);
    });

    it('should set .bandwidthProfileRevision to 0', () => {
      assert.equal(localParticipant.bandwidthProfileRevision, 0);
    });

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
          // eslint-disable-next-line no-warning-comments
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

          it('emits "updated" for each change in enabled/disable status', () => {
            publication.sid = 'MT123';
            publication.emit('updated');

            let updateCount = 0;
            localParticipant.on('updated', () => updateCount++);

            publication.enable(!publication.isEnabled);
            publication.emit('updated');
            assert.equal(updateCount, 1);

            publication.enable(publication.isEnabled);
            publication.emit('updated');
            // should not change update count as
            // publication enabled state was not changed.
            assert.equal(updateCount, 1);

            publication.enable(!publication.isEnabled);
            assert.equal(updateCount, 2);

            publication.enable(!publication.isEnabled);
            assert.equal(updateCount, 3);
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

  describe('#setBandwidthProfile', () => {
    [
      ['dominantSpeakerPriority', 'high'],
      ['maxSubscriptionBitrate', 3000],
      ['maxTracks', 4],
      ['mode', 'grid'],
      ['renderDimensions.high', { width: 4 }],
      ['renderDimensions.low', { height: 2 }],
      ['renderDimensions.standard', { width: 3 }],
      ['']
    ].forEach(([prop, value]) => {
      context(`when called with a BandwidthProfile that ${prop ? `has a different .${prop}` : 'is the same'}`, () => {
        let bandwidthProfileRevision;
        let initialBandwidthProfile;
        let newBandwidthProfile;
        let revision;
        let updated;

        beforeEach(() => {
          initialBandwidthProfile = {
            video: {
              dominantSpeakerPriority: 'low',
              maxSubscriptionBitrate: 2000,
              maxTracks: 3,
              mode: 'collaboration',
              renderDimensions: {
                high: { height: 3, width: 3 },
                low: { height: 1, width: 1 },
                standard: { height: 2, width: 2 }
              }
            }
          };

          localParticipant.setBandwidthProfile(initialBandwidthProfile);
          bandwidthProfileRevision = localParticipant.bandwidthProfileRevision;
          revision = localParticipant.revision;
          updated = false;

          const [mainProp, subProp] = prop.split('.');
          newBandwidthProfile = JSON.parse(JSON.stringify(initialBandwidthProfile));
          if (subProp) {
            newBandwidthProfile.video[mainProp][subProp] = Object.assign(newBandwidthProfile.video[mainProp][subProp], value);
          } else if (mainProp) {
            newBandwidthProfile.video[mainProp] = value;
          }
          localParticipant.once('updated', () => { updated = true; });

          localParticipant.setBandwidthProfile(newBandwidthProfile);
        });

        if (prop) {
          it('should set .bandwidthProfile to the new BandwidthProfile', () => {
            assert.deepEqual(localParticipant.bandwidthProfile, newBandwidthProfile);
          });

          it('should increment .bandwidthProfileRevision', () => {
            assert.equal(localParticipant.bandwidthProfileRevision, bandwidthProfileRevision + 1);
          });

          it('should increment .revision', () => {
            assert.equal(localParticipant.revision, revision + 1);
          });

          it('should emit "updated"', () => {
            assert(updated);
          });

          return;
        }

        it('should not change .bandwidthProfile', () => {
          assert.deepEqual(localParticipant.bandwidthProfile, initialBandwidthProfile);
        });

        it('should not increment .bandwidthProfileRevision', () => {
          assert.equal(localParticipant.bandwidthProfileRevision, bandwidthProfileRevision);
        });

        it('should not increment .revision', () => {
          assert.equal(localParticipant.revision, revision);
        });

        it('should not emit "updated"', () => {
          assert(!updated);
        });
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
    let updated;

    beforeEach(() => {
      localParticipant.addTrack(trackSender, name, priority);
      localTrackPublication = localParticipant.tracks.get(trackSender.id);
      revision = localParticipant.revision;
      localParticipant.once('updated', () => { updated = true; });
      updated = false;
    });

    [
      ['isEnabled', 'enable', false, true],
      ['updatedPriority', 'setPriority', makeUUID(), true],
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
        }
      });
    });
  });
});
