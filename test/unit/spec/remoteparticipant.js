'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const RemoteAudioTrackPublication = require('../../../lib/media/track/remoteaudiotrackpublication');
const RemoteDataTrackPublication = require('../../../lib/media/track/remotedatatrackpublication');
const RemoteParticipant = require('../../../lib/remoteparticipant');
const RemoteVideoTrackPublication = require('../../../lib/media/track/remotevideotrackpublication');
const { makeUUID } = require('../../../lib/util');

const { a, capitalize } = require('../../lib/util');
const log = require('../../lib/fakelog');

describe('RemoteParticipant', () => {
  describe('constructor', () => {
    it('sets .identity to the RemoteParticipantSignaling\'s .identity', () => {
      const test = makeTest();
      assert.equal(test.identity, test.participant.identity);
    });

    it('sets .sid to the RemoteParticipantSignaling\'s .sid', () => {
      const test = makeTest();
      assert.equal(test.sid, test.participant.sid);
    });

    it('sets .state to the RemoteParticipantSignaling\'s .state', () => {
      const test = makeTest();
      assert.equal(test.state, test.participant.state);
    });

    context('when RemoteTracks are provided', () => {
      let test;
      let audioTrack;
      let videoTrack;
      let dataTrack;

      before(() => {
        audioTrack = new EventEmitter();
        audioTrack.id = 'audioTrack';
        audioTrack.kind = 'audio';

        videoTrack = new EventEmitter();
        videoTrack.id = 'videoTrack';
        videoTrack.kind = 'video';

        dataTrack = new EventEmitter();
        dataTrack.id = 'dataTrack';
        dataTrack.kind = 'data';

        test = makeTest({ tracks: [audioTrack, videoTrack, dataTrack] });
      });

      it('should set .tracks to a Map of RemoteTrack ID => RemoteTrack', () => {
        assert.equal(test.participant.tracks.size, 3);
        test.participant.tracks.forEach(track => {
          assert.equal(track, {
            audio: audioTrack,
            video: videoTrack,
            data: dataTrack
          }[track.kind]);
        });
      });

      it('should set .audioTracks to a Map of RemoteAudioTrack ID => RemoteAudioTrack', () => {
        assert.equal(test.participant.audioTracks.size, 1);
        test.participant.audioTracks.forEach(track => {
          assert.equal(track, audioTrack);
        });
      });

      it('should set .videoTracks to a Map of RemoteVideoTrack ID => RemoteVideoTrack', () => {
        assert.equal(test.participant.videoTracks.size, 1);
        test.participant.videoTracks.forEach(track => {
          assert.equal(track, videoTrack);
        });
      });

      it('should set .dataTracks to a Map of RemoteDataTrack ID => RemoteDataTrack', () => {
        assert.equal(test.participant.dataTracks.size, 1);
        test.participant.dataTracks.forEach(track => {
          assert.equal(track, dataTrack);
        });
      });
    });

    context('when RemoteTracks are not provided', () => {
      let test;

      beforeEach(() => {
        test = makeTest();
      });

      it('should set .tracks to an empty Map', () => {
        assert.equal(test.participant.tracks.size, 0);
      });

      it('should set .audioTracks to an empty Map', () => {
        assert.equal(test.participant.audioTracks.size, 0);
      });

      it('should set .videoTracks to an empty Map', () => {
        assert.equal(test.participant.videoTracks.size, 0);
      });

      it('should set .dataTracks to an empty Map', () => {
        assert.equal(test.participant.dataTracks.size, 0);
      });
    });
  });

  [
    ['_addTrack', 'add', 'to'],
    ['_removeTrack', 'remove', 'from']
  ].forEach(([method, action, toOrFrom]) => {
    describe(`#${method}`, () => {
      let newTrack;
      let newTrackSignaling;
      let participantEvents;
      let publication;
      let ret;
      let test;
      let trackSignaling;
      let trackUnsubscribed;
      let tracksOnceTrackUnsubscribed;
      let tracksOnceUnsubscribed;
      let track;

      before(() => {
        test = makeTest();
      });

      ['Audio', 'Video', 'Data'].forEach(kind => {
        context(`when ${a(kind)} Remote${kind}Track with the same .id exists in .tracks`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrackSignaling = makeTrackSignaling({ id: trackSignaling.id, kind: kind.toLowerCase() });
            track = new test[`Remote${kind}Track`](trackSignaling.trackTransceiver);
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.trackTransceiver);
            test.participant.tracks.set(track.id, track);
            test.participant[`${kind.toLowerCase()}Tracks`].set(track.id, track);
            participantEvents = {};
            publication = new EventEmitter();
            publication._unsubscribe = () => { publication.emit('unsubscribed', track); };
            trackUnsubscribed = null;
            tracksOnceTrackUnsubscribed = null;
            tracksOnceUnsubscribed = null;
            ['trackSubscribed', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => {
                participantEvents[event] = track;
                if (event === 'trackUnsubscribed') {
                  tracksOnceTrackUnsubscribed = Array.from(test.participant.tracks.values());
                }
              });
            });
            publication.once('unsubscribed', track => {
              trackUnsubscribed = track;
              tracksOnceUnsubscribed = Array.from(test.participant.tracks.values());
            });
            ret = test.participant[method](newTrack, publication);
          });

          it(`${method === '_addTrack' ? 'should not' : 'should'} ${action} the Remote${kind}Track ${toOrFrom} .tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant.tracks.get(newTrack.id) === track
              : !test.participant.tracks.has(newTrack.id));
          });

          it(`${method === '_addTrack' ? 'should not' : 'should'} ${action} the Remote${kind}Track ${toOrFrom} .${kind.toLowerCase()}Tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant[`${kind.toLowerCase()}Tracks`].get(newTrack.id) === track
              : !test.participant[`${kind.toLowerCase()}Tracks`].has(newTrack.id));
          });

          it(`should return ${method === '_addTrack' ? 'null' : `the Remote${kind}Track`}`, () => {
            assert.equal(ret, method === '_addTrack' ? null : track);
          });

          if (method === '_addTrack') {
            it('should not emit "trackSubscribed"', () => {
              assert(!participantEvents.trackSubscribed);
            });
          } else {
            it('should emit "unsubscribed" on the removed corresponding RemoteTrackPublication', () => {
              assert.equal(trackUnsubscribed, track);
            });

            it('should have removed the RemoteTrack when the "unsubscribed" event was emitted', () => {
              assert.deepEqual(tracksOnceUnsubscribed, []);
            });

            it('should have removed the RemoteTrack when the "trackUnsubscribed" event was emitted', () => {
              assert.deepEqual(tracksOnceTrackUnsubscribed, []);
            });

            it('should emit "trackUnsubscribed"', () => {
              assert(participantEvents.trackUnsubscribed);
            });
          }
        });

        context(`when ${a(kind)} Remote${kind}Track with the same .id does not exist in .tracks`, () => {
          let sids = {};

          before(() => {
            newTrackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.trackTransceiver);
            participantEvents = {};
            ['trackSubscribed', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => { participantEvents[event] = track; sids[event] = track.sid; });
            });
            ret = test.participant[method](newTrack, makeRemoteTrackPublication(newTrackSignaling));
          });

          it(`${method === '_addTrack' ? 'should' : 'should not'} ${action} the Remote${kind}Track ${toOrFrom} .tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant.tracks.get(newTrack.id) === newTrack
              : !test.participant.tracks.has(newTrack.id));
          });

          it(`${method === '_addTrack' ? 'should' : 'should not'} ${action} the Remote${kind}Track ${toOrFrom} .${kind.toLowerCase()}Tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant[`${kind.toLowerCase()}Tracks`].get(newTrack.id) === newTrack
              : !test.participant[`${kind.toLowerCase()}Tracks`].has(newTrack.id));
          });

          it(`should return ${method === '_addTrack' ? `the Remote${kind}Track` : 'null'}`, () => {
            assert.equal(ret, method === '_addTrack' ? newTrack : null);
          });

          if (method === '_addTrack') {
            it('should emit "trackSubscribed"', () => {
              assert.equal(participantEvents.trackSubscribed, newTrack);
              assert.equal(typeof sids.trackSubscribed, 'string');
            });
          } else {
            it('should not emit "trackUnsubscribed"', () => {
              assert(!participantEvents.trackUnsubscribed);
            });
          }
        });
      });
    });
  });

  ['_addTrackPublication', '_removeTrackPublication'].forEach(method => {
    describe(`#${method}`, () => {
      let newPublication;
      let publication;
      let ret;
      let test;
      let trackEvents = { trackPublished: null, trackUnpublished: null };
      let trackSignaling;

      before(() => {
        test = makeTest();
      });

      ['audio', 'data', 'video'].forEach(kind => {
        context(`when a Remote${capitalize(kind)}TrackPublication with the same .trackSid exists in .trackPublications`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind });
            publication = makeRemoteTrackPublication(trackSignaling);
            test.participant.trackPublications.set(publication.trackSid, publication);
            test.participant[`${kind}TrackPublications`].set(publication.trackSid, publication);

            ['trackPublished', 'trackUnpublished'].forEach(event => {
              test.participant.once(event, publication => { trackEvents[event] = publication; });
            });
            newPublication = makeRemoteTrackPublication(trackSignaling);
            ret = test.participant[method](newPublication);
          });

          ({
            _addTrackPublication() {
              it(`should not add the Remote${capitalize(kind)}TrackPublication to .trackPublications`, () => {
                assert.equal(test.participant.trackPublications.get(newPublication.trackSid), publication);
              });

              it(`should not add the Remote${capitalize(kind)}TrackPublication to .${kind}TrackPublications`, () => {
                assert.equal(test.participant[`${kind}TrackPublications`].get(newPublication.trackSid), publication);
              });

              it('should return null', () => {
                assert.equal(ret, null);
              });

              it('should not emit "trackPublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackPublished, null);
              });
            },
            _removeTrackPublication() {
              it(`should remove the Remote${capitalize(kind)}TrackPublication from .trackPublications`, () => {
                assert(!test.participant.trackPublications.has(publication.trackSid));
              });

              it(`should remove the Remote${capitalize(kind)}TrackPublication from .${kind}TrackPublications`, () => {
                assert(!test.participant[`${kind}TrackPublications`].has(publication.trackSid));
              });

              it(`should return the removed Remote${capitalize(kind)}TrackPublication`, () => {
                assert.equal(ret, publication);
              });

              it('should emit "trackUnpublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackUnpublished, publication);
              });
            }
          })[method]();

          after(() => {
            trackEvents = { trackPublished: null, trackUnpublished: null };
          });
        });
        context(`when a Remote${capitalize(kind)}TrackPublication with the same .trackSid does not exist in .trackPublications`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind });
            publication = makeRemoteTrackPublication(trackSignaling);
            ['trackPublished', 'trackUnpublished'].forEach(event => {
              test.participant.once(event, publication => { trackEvents[event] = publication; });
            });
            ret = test.participant[method](publication);
          });

          ({
            _addTrackPublication() {
              it(`should add the Remote${capitalize(kind)}TrackPublication to .trackPublications`, () => {
                assert.equal(test.participant.trackPublications.get(publication.trackSid), publication);
              });

              it(`should add the Remote${capitalize(kind)}TrackPublication to .${kind}TrackPublications`, () => {
                assert.equal(test.participant[`${kind}TrackPublications`].get(publication.trackSid), publication);
              });

              it(`should return the added Remote${capitalize(kind)}TrackPublication`, () => {
                assert.equal(ret, publication);
              });

              it('should emit "trackPublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackPublished, publication);
              });
            },
            _removeTrackPublication() {
              it('should not change .trackPublications', () => {
                assert(!test.participant.trackPublications.has(publication.trackSid));
              });

              it(`should not change .${kind}TrackPublications`, () => {
                assert(!test.participant[`${kind}TrackPublications`].has(publication.trackSid));
              });

              it('should return null', () => {
                assert.equal(ret, null);
              });

              it('should not emit "trackUnpublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackUnpublished, null);
              });
            }
          })[method]();

          after(() => {
            trackEvents = { trackPublished: null, trackUnpublished: null };
          });
        });
      });
    });
  });

  describe('.tracks', () => {
    context('when the RemoteParticipant begins in .state "connected"', () => {
      it('re-emits "dimensionsChanged" events', () => {
        const track = new EventEmitter();
        let trackDimensionsChanged;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert.equal(track, trackDimensionsChanged);
      });

      it('re-emits "message" events', () => {
        const track = new EventEmitter();
        let trackMessageEvent;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackMessage', (data, track) => { trackMessageEvent = { data, track }; });
        const data = makeUUID();
        track.emit('message', data, track);
        assert.equal(data, trackMessageEvent.data);
        assert.equal(track, trackMessageEvent.track);
      });

      it('re-emits "started" events', () => {
        const track = new EventEmitter();
        let trackStarted;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert.equal(track, trackStarted);
      });

      it('re-emits "enabled" events', () => {
        const track = new EventEmitter();
        let trackEnabled;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert.equal(track, trackEnabled);
      });

      it('re-emits "disabled" events', () => {
        const track = new EventEmitter();
        let trackDisabled;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert.equal(track, trackDisabled);
      });
    });

    context('when the RemoteParticipant .state transitions to "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        const track = new EventEmitter();
        let trackDimensionsChanged;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "message" events', () => {
        const track = new EventEmitter();
        let trackMessageEvent;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackMessage', (data, track) => { trackMessageEvent = { data, track }; });
        const data = makeUUID();
        track.emit('message', data, track);
        assert(!trackMessageEvent);
      });

      it('does not re-emit "started" events', () => {
        const track = new EventEmitter();
        let trackStarted;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert(!trackStarted);
      });

      it('does not re-emit "enabled" events', () => {
        const track = new EventEmitter();
        let trackEnabled;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "disabled" events', () => {
        const track = new EventEmitter();
        let trackDisabled;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('should emit "trackUnsubscribed" events for all the Participant\'s RemoteTrackPublications', () => {
        const track = new EventEmitter();
        track._unsubscribe = () => {};
        const publication = makeRemoteTrackPublication(makeTrackSignaling());
        const test = makeTest();
        const unsubscribed = [];
        test.participant._addTrackPublication(publication);
        publication._subscribed(track);
        test.participant.on('trackUnsubscribed', track => unsubscribed.push(track));
        test.signaling.emit('stateChanged', 'disconnected');
        assert.equal(unsubscribed.length, 1);
        assert.equal(unsubscribed[0], track);
      });
    });

    context('when the RemoteParticipant .state begins in "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        const track = new EventEmitter();
        let trackDimensionsChanged;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "message" events', () => {
        const track = new EventEmitter();
        let trackMessageEvent;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackMessage', (data, track) => { trackMessageEvent = { data, track }; });
        const data = makeUUID();
        track.emit('message', data, track);
        assert(!trackMessageEvent);
      });

      it('does not re-emit "enabled" events', () => {
        const track = new EventEmitter();
        let trackEnabled;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "disabled" events', () => {
        const track = new EventEmitter();
        let trackDisabled;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "started" events', () => {
        const track = new EventEmitter();
        let trackStarted;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert(!trackStarted);
      });
    });
  });

  describe('.trackPublications', () => {
    context('when the RemoteParticipant begins in .state "connected"', () => {
      let publication;
      let test;
      let trackSignaling;

      before(() => {
        test = makeTest();
        trackSignaling = makeTrackSignaling();
        publication = makeRemoteTrackPublication(trackSignaling);
        test.participant._addTrackPublication(publication);
      });

      [
        ['subscriptionFailed', 'trackSubscriptionFailed']
        // NOTE(mroberts): Re-enable these tests when we migrate to twilio-video.js@2.0.0.
        // ['trackDisabled', 'trackDisabled'],
        // ['trackEnabled', 'trackEnabled']
      ].forEach(([publicationEvent, participantEvent]) => {
        it(`re-emits "${publicationEvent}" event`, () => {
          const error = new Error('foo');
          let eventArgs;
          test.participant.once(participantEvent, (...args) => { eventArgs = args; });

          ({
            subscriptionFailed: () => publication.emit(publicationEvent, error),
            trackDisabled: () => publication.emit(publicationEvent),
            trackEnabled: () => publication.emit(publicationEvent)
          })[publicationEvent]();

          assert.equal(eventArgs[0], {
            subscriptionFailed: error,
            trackDisabled: publication,
            trackEnabled: publication
          }[publicationEvent]);

          if (publicationEvent === 'subscriptionFailed') {
            assert.equal(eventArgs[1], publication);
          }
        });
      });
    });

    context('when the RemoteParticipant .state transitions to "disconnected"', () => {
      let publication;
      let test;
      let trackSignaling;

      before(() => {
        test = makeTest();
        trackSignaling = makeTrackSignaling();
        publication = makeRemoteTrackPublication(trackSignaling);
        test.participant._addTrackPublication(publication);
        test.signaling.state = 'disconnected';
        test.signaling.emit('stateChanged', 'disconnected');
      });

      [
        ['subscriptionFailed', 'trackSubscriptionFailed'],
        ['trackDisabled', 'trackDisabled'],
        ['trackEnabled', 'trackEnabled']
      ].forEach(([publicationEvent, participantEvent]) => {
        it(`should not re-emit "${publicationEvent}" event`, () => {
          const error = new Error('foo');
          let eventArgs;
          test.participant.once(participantEvent, (...args) => { eventArgs = args; });

          ({
            subscriptionFailed: () => publication.emit(publicationEvent, error),
            trackDisabled: () => publication.emit(publicationEvent),
            trackEnabled: () => publication.emit(publicationEvent)
          })[publicationEvent]();

          assert(!eventArgs);
        });
      });
    });

    context('when the RemoteParticipant .state begins in "disconnected"', () => {
      let publication;
      let test;
      let trackSignaling;

      before(() => {
        test = makeTest({ state: 'disconnected' });
        trackSignaling = makeTrackSignaling();
        publication = makeRemoteTrackPublication(trackSignaling);
        test.participant._addTrackPublication(publication);
      });

      [
        ['subscriptionFailed', 'trackSubscriptionFailed'],
        ['trackDisabled', 'trackDisabled'],
        ['trackEnabled', 'trackEnabled']
      ].forEach(([publicationEvent, participantEvent]) => {
        it(`should not re-emit "${publicationEvent}" event`, () => {
          const error = new Error('foo');
          let eventArgs;
          test.participant.once(participantEvent, (...args) => { eventArgs = args; });

          ({
            subscriptionFailed: () => publication.emit(publicationEvent, error),
            trackDisabled: () => publication.emit(publicationEvent),
            trackEnabled: () => publication.emit(publicationEvent)
          })[publicationEvent]();

          assert(!eventArgs);
        });
      });
    });
  });

  describe('RemoteParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('re-emits the "disconnected" state event', () => {
          const test = makeTest();
          let disconnected;
          test.participant.once('disconnected', participant => { disconnected = participant; });
          test.signaling.emit('stateChanged', 'disconnected');
          assert.equal(test.participant, disconnected);
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        it('re-emits the "disconnected" state event', () => {
          const test = makeTest();
          let disconnected;
          test.signaling.emit('stateChanged', 'disconnected');
          test.participant.once('disconnected', () => { disconnected = true; });
          test.signaling.emit('stateChanged', 'disconnected');
          assert(!disconnected);
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('re-emits the "disconnected" state event', () => {
          const test = makeTest({ state: 'disconnected' });
          let disconnected;
          test.participant.once('disconnected', () => { disconnected = true; });
          test.signaling.emit('stateChanged', 'disconnected');
          assert(!disconnected);
        });
      });
    });

    context('"trackSubscriptionFailed" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        context('and a RemoteTrackPublicationSignaling fails to subscribe', () => {
          it('does not create the RemoteTrack or add it to .tracks', () => {
            const test = makeTest();

            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(audioTrack.sid));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(videoTrack.sid));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(dataTrack.sid));
          });

          it('emits a "trackSubscriptionFailed" event with the RemoteTrackPublicationSignaling\'s error', async () => {
            const test = makeTest();

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            await testTrackSubscriptionFailed(test.participant, audioTrack);
            await testTrackSubscriptionFailed(test.participant, videoTrack);
            await testTrackSubscriptionFailed(test.participant, dataTrack);
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        context('and a RemoteTrackPublication fails to subscribe', () => {
          it('does not create the RemoteTrack or add it to .tracks', () => {
            const test = makeTest();
            test.signaling.emit('stateChanged', 'disconnected');

            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(audioTrack.sid));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(videoTrack.sid));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(dataTrack.sid));
          });

          it('does not emit a "trackSubscriptionFailed" event', () => {
            const test = makeTest();
            test.signaling.emit('stateChanged', 'disconnected');

            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            let trackSubscriptionFailed = false;
            test.participant.once('trackSubscriptionFailed', () => { trackSubscriptionFailed = true; });

            audioTrack.subscribeFailed(new Error());
            videoTrack.subscribeFailed(new Error());
            dataTrack.subscribeFailed(new Error());

            assert(!trackSubscriptionFailed);
          });
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        context('and a RemoteTrackPublication fails to subscribe', () => {
          it('does not create the RemoteTrack or add it to .tracks', () => {
            const test = makeTest({ state: 'disconnected' });

            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(audioTrack.sid));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(videoTrack.sid));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant.tracks.has(dataTrack.sid));
          });

          it('does not emit a "trackSubscriptionFailed" event', () => {
            const test = makeTest({ state: 'disconnected' });

            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            let trackSubscriptionFailed = false;
            test.participant.once('trackSubscriptionFailed', () => { trackSubscriptionFailed = true; });

            audioTrack.subscribeFailed(new Error());
            videoTrack.subscribeFailed(new Error());
            dataTrack.subscribeFailed(new Error());

            assert(!trackSubscriptionFailed);
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('should construct a RemoteTrackPublication for each RemoteTrackPublicationSignaling', () => {
          const test = makeTest({
            trackSignalings: [
              makeTrackSignaling({ kind: 'audio' }),
              makeTrackSignaling({ kind: 'data' }),
              makeTrackSignaling({ kind: 'video' })
            ]
          });
          const [audioTrack, dataTrack, videoTrack] = test.trackSignalings;
          assert(test.participant.trackPublications.has(audioTrack.sid));
          assert(test.participant[`${audioTrack.kind}TrackPublications`].has(audioTrack.sid));
          assert(test.participant.trackPublications.has(dataTrack.sid));
          assert(test.participant[`${dataTrack.kind}TrackPublications`].has(dataTrack.sid));
          assert(test.participant.trackPublications.has(videoTrack.sid));
          assert(test.participant[`${videoTrack.kind}TrackPublications`].has(videoTrack.sid));
        });

        context('if emits "updated" on RemoteTrackPublicationSignaling due to .setTrackTransceiver', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the RemoteTrackPublicationSignaling\'s .kind', () => {
            const test = makeTest({
              trackSignalings: [
                makeTrackSignaling({ kind: 'audio', testTrackSubscriptionRestApi: true }),
                makeTrackSignaling({ kind: 'video', testTrackSubscriptionRestApi: true }),
                makeTrackSignaling({ kind: 'data', testTrackSubscriptionRestApi: true })
              ]
            });
            const audioTrack = test.trackSignalings[0];
            const videoTrack = test.trackSignalings[1];
            const dataTrack = test.trackSignalings[2];

            function updated(trackSignaling) {
              return new Promise(resolve => trackSignaling.once('updated', resolve));
            }

            const updateds = [
              updated(audioTrack),
              updated(videoTrack),
              updated(dataTrack)
            ];

            audioTrack.setTrackTransceiver({ id: audioTrack.id, kind: audioTrack.kind, track: {} });
            videoTrack.setTrackTransceiver({ id: videoTrack.id, kind: videoTrack.kind, track: {} });
            dataTrack.setTrackTransceiver({ id: dataTrack.id, kind: dataTrack.kind, track: {} });

            return Promise.all(updateds).then(() => {
              assert.equal(audioTrack.trackTransceiver, test.RemoteAudioTrack.args[0][0]);
              assert.equal(videoTrack.trackTransceiver, test.RemoteVideoTrack.args[0][0]);
              assert.equal(dataTrack.trackTransceiver, test.RemoteDataTrack.args[0][0]);
            });
          });

          it('calls ._addTrack on the RemoteParticipant with the newly-constructed RemoteTrack', () => {
            const test = makeTest({
              trackSignalings: [
                makeTrackSignaling({ kind: 'audio', testTrackSubscriptionRestApi: true }),
                makeTrackSignaling({ kind: 'video', testTrackSubscriptionRestApi: true }),
                makeTrackSignaling({ kind: 'data', testTrackSubscriptionRestApi: true })
              ]
            });
            const tracksAddedPromise = new Promise(resolve => {
              const tracks = [];
              test.participant.on('trackSubscribed', track => {
                tracks.push(track);
                if (tracks.length === 2) {
                  resolve(tracks);
                }
              });
            });

            const audioTrack = test.trackSignalings[0];
            const videoTrack = test.trackSignalings[1];
            const dataTrack = test.trackSignalings[2];

            function updated(trackSignaling) {
              return new Promise(resolve => trackSignaling.once('updated', resolve));
            }

            const updateds = [
              updated(audioTrack),
              updated(videoTrack),
              updated(dataTrack)
            ];

            audioTrack.setTrackTransceiver({ id: audioTrack.id, kind: audioTrack.kind, track: {} });
            videoTrack.setTrackTransceiver({ id: videoTrack.id, kind: videoTrack.kind, track: {} });
            dataTrack.setTrackTransceiver({ id: dataTrack.id, kind: dataTrack.kind, track: {} });

            return Promise.all([
              tracksAddedPromise,
              ...updateds
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
              assert.equal(test.tracks[2], results[0][2]);
            });
          });
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('should not construct a RemoteTrackPublication for each RemoteTrackPublicationSignaling', () => {
          const test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              makeTrackSignaling({ kind: 'audio' }),
              makeTrackSignaling({ kind: 'data' }),
              makeTrackSignaling({ kind: 'video' })
            ]
          });
          const [audioTrack, dataTrack, videoTrack] = test.trackSignalings;
          assert(!test.participant.trackPublications.has(audioTrack.sid));
          assert(!test.participant[`${audioTrack.kind}TrackPublications`].has(audioTrack.sid));
          assert(!test.participant.trackPublications.has(dataTrack.sid));
          assert(!test.participant[`${dataTrack.kind}TrackPublications`].has(dataTrack.sid));
          assert(!test.participant.trackPublications.has(videoTrack.sid));
          assert(!test.participant[`${videoTrack.kind}TrackPublications`].has(videoTrack.sid));
        });

        it('does not construct new RemoteTracks', () => {
          const test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              makeTrackSignaling({ kind: 'audio' }),
              makeTrackSignaling({ kind: 'video' }),
              makeTrackSignaling({ kind: 'data' })
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          const dataTrack = test.trackSignalings[1];

          audioTrack.setTrackTransceiver({ id: audioTrack.id, kind: audioTrack.kind, track: {} });
          videoTrack.setTrackTransceiver({ id: videoTrack.id, kind: videoTrack.kind, track: {} });
          dataTrack.setTrackTransceiver({ id: dataTrack.id, kind: dataTrack.kind, track: {} });
          assert.equal(0, test.tracks.length);
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          const test = makeTest({
            participant: { _addTrack: sinon.spy() },
            state: 'disconnected',
            trackSignalings: [
              makeTrackSignaling({ kind: 'audio' }),
              makeTrackSignaling({ kind: 'video' }),
              makeTrackSignaling({ kind: 'data' })
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          const dataTrack = test.trackSignalings[2];

          audioTrack.setTrackTransceiver({ id: audioTrack.id, kind: audioTrack.kind, track: {} });
          videoTrack.setTrackTransceiver({ id: videoTrack.id, kind: videoTrack.kind, track: {} });
          dataTrack.setTrackTransceiver({ id: dataTrack.id, kind: dataTrack.kind, track: {} });
          assert(!test.participant._addTrack.calledOnce);
        });
      });
    });
  });
});


function makeIdentity() {
  return Math.random().toString(36).slice(2);
}

function makeSid() {
  let sid = 'PA';
  for (let i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeTest(options) {
  options = options || {};
  options.identity = options.identity || makeIdentity();
  options.sid = options.sid || makeSid();
  options.state = options.state || 'connected';
  options.tracks = options.tracks || [];

  if (typeof options.trackSignalings === 'number') {
    const trackSignalings = [];
    for (let i = 0; i < options.trackSignalings; i++) {
      trackSignalings.push(makeTrackSignaling(options));
    }
    options.trackSignalings = trackSignalings;
  }
  options.trackSignalings = options.trackSignalings || [];

  options.RemoteAudioTrack = sinon.spy(function RemoteAudioTrack(mediaTrackReceiver, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this.id = mediaTrackReceiver.id;
    this.kind = mediaTrackReceiver.kind;
    this.mediaStreamTrack = mediaTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : this.id;
    this.sid = null;
    this._setEnabled = enabled => { this.enabled = enabled; };
    this._setSid = sid => { this.sid = sid; };
    this._unsubscribe = () => {};
    options.tracks.push(this);
  });
  inherits(options.RemoteAudioTrack, EventEmitter);

  options.RemoteVideoTrack = sinon.spy(function RemoteVideoTrack(mediaTrackReceiver, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this.id = mediaTrackReceiver.id;
    this.kind = mediaTrackReceiver.kind;
    this.mediaStreamTrack = mediaTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : this.id;
    this.sid = null;
    this._setEnabled = enabled => { this.enabled = enabled; };
    this._setSid = sid => { this.sid = sid; };
    this._unsubscribe = () => {};
    options.tracks.push(this);
  });
  inherits(options.RemoteVideoTrack, EventEmitter);

  options.RemoteDataTrack = sinon.spy(function RemoteDataTrack(dataTrackReceiver, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this._dataTrackReceiver = dataTrackReceiver;
    this.id = dataTrackReceiver.id;
    this.kind = dataTrackReceiver.kind;
    this.mediaStreamTrack = dataTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : this.id;
    this.sid = null;
    this._setEnabled = enabled => { this.enabled = enabled; };
    this._setSid = sid => { this.sid = sid; };
    this._unsubscribe = () => {};
    options.tracks.push(this);
  });
  inherits(options.RemoteDataTrack, EventEmitter);

  options.log = log;
  options.signaling = options.signaling || makeSignaling(options);
  options.participant = options.participant || new RemoteParticipant(options.signaling, options);

  return options;
}

function makeSignaling(options) {
  const signaling = new EventEmitter();
  signaling.sid = options.sid;
  signaling.identity = options.identity;
  signaling.state = options.state;
  signaling.tracks = options.trackSignalings;
  return signaling;
}

function makeId() {
  return makeUUID();
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeRemoteTrackPublication(trackSignaling) {
  const publication = new EventEmitter();
  publication.kind = trackSignaling.kind;
  publication.track = null;
  publication.trackSid = trackSignaling.sid;
  publication.trackName = trackSignaling.name;

  Object.defineProperties(publication, {
    isSubscribed: {
      get() {
        return !!publication.track;
      }
    }
  });

  publication._subscribed = track => {
    publication.track = track;
    publication.emit('subscribed', track);
  };
  publication._unsubscribe = () => {
    const track = publication.track;
    publication.track = null;
    publication.emit('unsubscribed', track);
  };
  return publication;
}

function makeTrackSignaling(options) {
  options = options || {};
  const track = new EventEmitter();
  track.id = options.id || makeId();
  track.isSubscribed = false;
  track.kind = options.kind || makeKind();
  track.name = options.name || track.id;
  track.sid = options.sid || makeId();
  track.setTrackTransceiver = trackTransceiver => {
    track.trackTransceiver = trackTransceiver;
    track.isSubscribed = !!track.trackTransceiver;
    track.emit('updated');
  };
  track.subscribeFailed = error => {
    track.error = error;
    track.emit('updated');
  };
  track.trackTransceiver = null;
  if (!options.shouldSubscriptionFail && !options.testTrackSubscriptionRestApi) {
    track.setTrackTransceiver({ id: track.id, kind: track.kind, track: {} });
  }
  track.mediaStream = {};
  return track;
}

async function testTrackSubscriptionFailed(participant, track) {
  let actualError;
  let trackPublication;

  const promise = new Promise(resolve => {
    participant.once('trackSubscriptionFailed', (error, _trackPublication) => {
      actualError = error;
      trackPublication = _trackPublication;
      resolve();
    });
  });

  const expectedError = new Error();
  track.subscribeFailed(expectedError);
  await promise;

  assert.equal(actualError, expectedError);
  assert(trackPublication instanceof {
    audio: RemoteAudioTrackPublication,
    data: RemoteDataTrackPublication,
    video: RemoteVideoTrackPublication
  }[trackPublication.kind]);
  assert.equal(trackPublication.kind, track.kind);
  assert.equal(trackPublication.trackName, track.name);
  assert.equal(trackPublication.trackSid, track.sid);
}
