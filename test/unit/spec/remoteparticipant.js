/* eslint-disable require-await */
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

const { a, capitalize, combinationContext } = require('../../lib/util');
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

      it('should set ._tracks to a Map of RemoteTrack ID => RemoteTrack', () => {
        assert.equal(test.participant._tracks.size, 3);
        test.participant._tracks.forEach(track => {
          assert.equal(track, {
            audio: audioTrack,
            video: videoTrack,
            data: dataTrack
          }[track.kind]);
        });
      });

      it('should set ._audioTracks to a Map of RemoteAudioTrack ID => RemoteAudioTrack', () => {
        assert.equal(test.participant._audioTracks.size, 1);
        test.participant._audioTracks.forEach(track => {
          assert.equal(track, audioTrack);
        });
      });

      it('should set ._videoTracks to a Map of RemoteVideoTrack ID => RemoteVideoTrack', () => {
        assert.equal(test.participant._videoTracks.size, 1);
        test.participant._videoTracks.forEach(track => {
          assert.equal(track, videoTrack);
        });
      });

      it('should set ._dataTracks to a Map of RemoteDataTrack ID => RemoteDataTrack', () => {
        assert.equal(test.participant._dataTracks.size, 1);
        test.participant._dataTracks.forEach(track => {
          assert.equal(track, dataTrack);
        });
      });
    });

    context('when RemoteTracks are not provided', () => {
      let test;

      beforeEach(() => {
        test = makeTest();
      });

      it('should set ._tracks to an empty Map', () => {
        assert.equal(test.participant._tracks.size, 0);
      });

      it('should set ._audioTracks to an empty Map', () => {
        assert.equal(test.participant._audioTracks.size, 0);
      });

      it('should set ._videoTracks to an empty Map', () => {
        assert.equal(test.participant._videoTracks.size, 0);
      });

      it('should set ._dataTracks to an empty Map', () => {
        assert.equal(test.participant._dataTracks.size, 0);
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
        context(`when ${a(kind)} Remote${kind}Track with the same RemoteTrackPublicationSignaling .id exists in .tracks`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrackSignaling = makeTrackSignaling({ id: trackSignaling.id, kind: kind.toLowerCase() });
            track = new test[`Remote${kind}Track`]('foo', trackSignaling.trackTransceiver);
            newTrack = new test[`Remote${kind}Track`]('foo', newTrackSignaling.trackTransceiver);
            test.participant._tracks.set(trackSignaling.id, track);
            test.participant[`_${kind.toLowerCase()}Tracks`].set(trackSignaling.id, track);
            participantEvents = {};
            publication = new EventEmitter();
            publication._subscribed = track => { publication.emit('subscribed', track); };
            publication._unsubscribe = () => { publication.emit('unsubscribed', track); };
            trackUnsubscribed = null;
            tracksOnceTrackUnsubscribed = null;
            tracksOnceUnsubscribed = null;
            ['trackSubscribed', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => {
                participantEvents[event] = track;
                if (event === 'trackUnsubscribed') {
                  tracksOnceTrackUnsubscribed = Array.from(test.participant._tracks.values());
                }
              });
            });
            publication.once('unsubscribed', track => {
              trackUnsubscribed = track;
              tracksOnceUnsubscribed = Array.from(test.participant._tracks.values());
            });
            ret = test.participant[method](newTrack, publication, newTrackSignaling.id);
          });

          it(`${method === '_addTrack' ? 'should not' : 'should'} ${action} the Remote${kind}Track ${toOrFrom} ._tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant._tracks.get(newTrackSignaling.id) === track
              : !test.participant._tracks.has(newTrackSignaling.id));
          });

          it(`${method === '_addTrack' ? 'should not' : 'should'} ${action} the Remote${kind}Track ${toOrFrom} ._${kind.toLowerCase()}Tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant[`_${kind.toLowerCase()}Tracks`].get(newTrackSignaling.id) === track
              : !test.participant[`_${kind.toLowerCase()}Tracks`].has(newTrackSignaling.id));
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

        context(`when ${a(kind)} Remote${kind}Track with the same RemoteTrackPublicationSignaling .id does not exist in ._tracks`, () => {
          let sids = {};

          before(() => {
            newTrackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrack = new test[`Remote${kind}Track`]('foo', newTrackSignaling.trackTransceiver);
            participantEvents = {};
            ['trackSubscribed', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => { participantEvents[event] = track; sids[event] = track.sid; });
            });
            ret = test.participant[method](newTrack, makeRemoteTrackPublication(newTrackSignaling), newTrackSignaling.id);
          });

          it(`${method === '_addTrack' ? 'should' : 'should not'} ${action} the Remote${kind}Track ${toOrFrom} ._tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant._tracks.get(newTrackSignaling.id) === newTrack
              : !test.participant._tracks.has(newTrackSignaling.id));
          });

          it(`${method === '_addTrack' ? 'should' : 'should not'} ${action} the Remote${kind}Track ${toOrFrom} ._${kind.toLowerCase()}Tracks`, () => {
            assert(method === '_addTrack'
              ? test.participant[`_${kind.toLowerCase()}Tracks`].get(newTrackSignaling.id) === newTrack
              : !test.participant[`_${kind.toLowerCase()}Tracks`].has(newTrackSignaling.id));
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
        context(`when a Remote${capitalize(kind)}TrackPublication with the same .trackSid exists in .tracks`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind });
            publication = makeRemoteTrackPublication(trackSignaling);
            test.participant.tracks.set(publication.trackSid, publication);
            test.participant[`${kind}Tracks`].set(publication.trackSid, publication);

            ['trackPublished', 'trackUnpublished'].forEach(event => {
              test.participant.once(event, publication => { trackEvents[event] = publication; });
            });
            newPublication = makeRemoteTrackPublication(trackSignaling);
            ret = test.participant[method](newPublication);
          });

          ({
            _addTrackPublication() {
              it(`should not add the Remote${capitalize(kind)}TrackPublication to .tracks`, () => {
                assert.equal(test.participant.tracks.get(newPublication.trackSid), publication);
              });

              it(`should not add the Remote${capitalize(kind)}TrackPublication to .${kind}Tracks`, () => {
                assert.equal(test.participant[`${kind}Tracks`].get(newPublication.trackSid), publication);
              });

              it('should return null', () => {
                assert.equal(ret, null);
              });

              it('should not emit "trackPublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackPublished, null);
              });
            },
            _removeTrackPublication() {
              it(`should remove the Remote${capitalize(kind)}TrackPublication from .tracks`, () => {
                assert(!test.participant.tracks.has(publication.trackSid));
              });

              it(`should remove the Remote${capitalize(kind)}TrackPublication from .${kind}Tracks`, () => {
                assert(!test.participant[`${kind}Tracks`].has(publication.trackSid));
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
        context(`when a Remote${capitalize(kind)}TrackPublication with the same .trackSid does not exist in .tracks`, () => {
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
              it(`should add the Remote${capitalize(kind)}TrackPublication to .tracks`, () => {
                assert.equal(test.participant.tracks.get(publication.trackSid), publication);
              });

              it(`should add the Remote${capitalize(kind)}TrackPublication to .${kind}Tracks`, () => {
                assert.equal(test.participant[`${kind}Tracks`].get(publication.trackSid), publication);
              });

              it(`should return the added Remote${capitalize(kind)}TrackPublication`, () => {
                assert.equal(ret, publication);
              });

              it('should emit "trackPublished" on the RemoteParticipant', () => {
                assert.equal(trackEvents.trackPublished, publication);
              });
            },
            _removeTrackPublication() {
              it('should not change .tracks', () => {
                assert(!test.participant.tracks.has(publication.trackSid));
              });

              it(`should not change .${kind}Tracks`, () => {
                assert(!test.participant[`${kind}Tracks`].has(publication.trackSid));
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

  describe('._tracks', () => {
    context('when the RemoteParticipant begins in .state "connected"', () => {
      it('re-emits "dimensionsChanged" events', () => {
        let trackDimensionsChanged;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert.equal(track, trackDimensionsChanged);
      });

      it('re-emits "message" events', () => {
        let trackMessageEvent;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.participant.once('trackMessage', (data, track) => { trackMessageEvent = { data, track }; });
        const data = makeUUID();
        track.emit('message', data, track);
        assert.equal(data, trackMessageEvent.data);
        assert.equal(track, trackMessageEvent.track);
      });

      it('re-emits "started" events', () => {
        let trackStarted;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert.equal(track, trackStarted);
      });
    });

    context('when the RemoteParticipant .state transitions to "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        let trackDimensionsChanged;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "message" events', () => {
        let trackMessageEvent;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackMessage', (data, track) => { trackMessageEvent = { data, track }; });
        const data = makeUUID();
        track.emit('message', data, track);
        assert(!trackMessageEvent);
      });

      it('does not re-emit "started" events', () => {
        let trackStarted;
        const test = makeTest({ trackSignalings: [makeTrackSignaling()] });
        const track = [...test.participant._tracks.values()][0];
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert(!trackStarted);
      });

      it('should emit "trackUnsubscribed" events for all the Participant\'s RemoteTrackPublications', () => {
        const track = {};
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

  describe('.tracks', () => {
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
        ['subscriptionFailed', 'trackSubscriptionFailed'],
        ['trackDisabled', 'trackDisabled'],
        ['trackEnabled', 'trackEnabled']
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
      combinationContext([
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `"${x}"`
        ],
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `and RemoteParticipantSignaling's .state transitions to "${x}"`
        ]
      ], ([state, newState]) => {
        if (state === 'disconnected' || state === newState) {
          return;
        }

        const participantEvent = {
          connected: { reconnecting: 'reconnecting', disconnected: 'disconnected' },
          reconnecting: { connected: 'reconnected', disconnected: 'disconnected' }
        }[state][newState];

        it(`should emit "${participantEvent}" on the Participant`, () => {
          const test = makeTest({ state });
          const eventPromise = new Promise(resolve => test.participant.once(participantEvent, resolve));
          test.signaling.emit('stateChanged', newState);
          return eventPromise;
        });
      });
    });

    context('"trackAdded" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('constructs a new RemoteTrackPublication from the underlying RemoteTrackPublicationSignaling', () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          const audioTrackPublication = test.participant.tracks.get(audioTrack.sid);
          const dataTrackPublication = test.participant.tracks.get(dataTrack.sid);
          const videoTrackPublication = test.participant.tracks.get(videoTrack.sid);
          assert(audioTrackPublication instanceof RemoteAudioTrackPublication);
          assert.equal(test.participant.audioTracks.get(audioTrack.sid), audioTrackPublication);
          assert(dataTrackPublication instanceof RemoteDataTrackPublication);
          assert.equal(test.participant.dataTracks.get(dataTrack.sid), dataTrackPublication);
          assert(videoTrackPublication instanceof RemoteVideoTrackPublication);
          assert.equal(test.participant.videoTracks.get(videoTrack.sid), videoTrackPublication);
        });

        it('emits "trackPublished" events for each RemoteTrackPublication on the RemoteParticipant', () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          const publications = [];
          test.participant.on('trackPublished', publication => publications.push(publication));
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);

          assert.equal(publications.length, 3);
          publications.forEach(publication => {
            assert(publication instanceof {
              audio: RemoteAudioTrackPublication,
              data: RemoteDataTrackPublication,
              video: RemoteVideoTrackPublication
            }[publication.kind]);
            assert.equal(test.participant.tracks.get(publication.trackSid), publication);
            assert.equal(test.participant[`${publication.kind}Tracks`].get(publication.trackSid), publication);
          });
        });

        context('if "updated" is emitted on the RemoteTrackPublicationSignaling due to .setTrackTransceiver', () => {
          it('constructs a new RemoteTrack and sets its .name to that of the underlying RemoteTrackPublicationSignaling', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio', testTrackSubscriptionRestApi: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', testTrackSubscriptionRestApi: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', testTrackSubscriptionRestApi: true });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

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
              assert.equal(audioTrack.trackTransceiver, test.RemoteAudioTrack.args[0][1]);
              assert.equal(audioTrack.name, test.tracks[0].name);

              assert.equal(videoTrack.trackTransceiver, test.RemoteVideoTrack.args[0][1]);
              assert.equal(videoTrack.name, test.tracks[1].name);

              assert.equal(dataTrack.trackTransceiver, test.RemoteDataTrack.args[0][1]);
              assert.equal(dataTrack.name, test.tracks[2].name);
            });
          });

          it('adds the newly-constructed RemoteTrack to the RemoteParticipant\'s RemoteTrack collections', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio', testTrackSubscriptionRestApi: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', testTrackSubscriptionRestApi: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', testTrackSubscriptionRestApi: true });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

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
              assert.equal(test.tracks[0], test.participant._tracks.get(audioTrack.id));
              assert.equal(test.tracks[1], test.participant._tracks.get(videoTrack.id));
              assert.equal(test.tracks[2], test.participant._tracks.get(dataTrack.id));
              assert.equal(test.tracks[0], test.participant._audioTracks.get(audioTrack.id));
              assert.equal(test.tracks[1], test.participant._videoTracks.get(videoTrack.id));
              assert.equal(test.tracks[2], test.participant._dataTracks.get(dataTrack.id));
            });
          });


          it('fires the "trackSubscribed" event on the RemoteParticipant', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio', testTrackSubscriptionRestApi: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', testTrackSubscriptionRestApi: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', testTrackSubscriptionRestApi: true });
            const subscribed = [];
            const subscribedPublications = [];

            const trackSubscribedPromise = new Promise(resolve => {
              function shouldResolve() {
                return subscribed.length + subscribedPublications.length === 6;
              }
              test.participant.on('trackSubscribed', (track, publication) => {
                subscribed.push(track);
                subscribedPublications.push(publication);
                if (shouldResolve()) {
                  resolve();
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

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
              trackSubscribedPromise,
              ...updateds
            ]).then(() => {
              assert.equal(test.tracks[0], subscribed[0]);
              assert.equal(test.tracks[1], subscribed[1]);
              assert.equal(test.tracks[2], subscribed[2]);
              subscribedPublications.forEach(publication => assert.equal(publication, test.participant.tracks.get(publication.trackSid)));
            });
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        it('should not create a RemoteTrackPublication for the underlying RemoteTrackPublicationSignaling', () => {
          const test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.participant.tracks.has(audioTrack.sid));
          assert(!test.participant.audioTracks.has(audioTrack.sid));
          assert(!test.participant.tracks.has(dataTrack.sid));
          assert(!test.participant.dataTracks.has(dataTrack.sid));
          assert(!test.participant.tracks.has(videoTrack.sid));
          assert(!test.participant.videoTracks.has(videoTrack.sid));
        });

        it('should not emit "trackPublished" on the RemoteParticipant', () => {
          const test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          const publications = [];
          test.participant.on('trackPublished', publication => publications.push(publication));
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert.equal(publications.length, 0);
        });

        it('does not construct a new RemoteTrack', () => {
          const test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
          assert(!test.RemoteDataTrack.calledOnce);
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          const test = makeTest();
          test.participant._addTrack = sinon.spy();
          test.signaling.emit('stateChanged', 'disconnected');
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.participant._addTrack.calledOnce);
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('should not create a RemoteTrackPublication for the underlying RemoteTrackPublicationSignaling', () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.participant.tracks.has(audioTrack.sid));
          assert(!test.participant.audioTracks.has(audioTrack.sid));
          assert(!test.participant.tracks.has(dataTrack.sid));
          assert(!test.participant.dataTracks.has(dataTrack.sid));
          assert(!test.participant.tracks.has(videoTrack.sid));
          assert(!test.participant.videoTracks.has(videoTrack.sid));
        });

        it('should not emit "trackPublished" on the RemoteParticipant', () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          const publications = [];
          test.participant.on('trackPublished', publication => publications.push(publication));
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert.equal(publications.length, 0);
        });

        it('does not construct a new RemoteTrack', () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
          assert(!test.RemoteDataTrack.calledOnce);
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          const test = makeTest({ state: 'disconnected' });
          test.participant._addTrack = sinon.spy();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.participant._addTrack.calledOnce);
        });
      });
    });

    context('"trackSubscriptionFailed" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        context('and a RemoteTrackPublicationSignaling fails to subscribe', () => {
          it('does not create the RemoteTrack or add it to ._tracks', () => {
            const test = makeTest();

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(audioTrack.id));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(videoTrack.id));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(dataTrack.id));
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
          it('does not create the RemoteTrack or add it to ._tracks', () => {
            const test = makeTest();
            test.signaling.emit('stateChanged', 'disconnected');

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(audioTrack.id));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(videoTrack.id));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(dataTrack.id));
          });

          it('does not emit a "trackSubscriptionFailed" event', () => {
            const test = makeTest();
            test.signaling.emit('stateChanged', 'disconnected');

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

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
          it('does not create the RemoteTrack or add it to ._tracks', () => {
            const test = makeTest({ state: 'disconnected' });

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            audioTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(audioTrack.id));

            videoTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(videoTrack.id));

            dataTrack.subscribeFailed(new Error());
            assert(!test.participant._tracks.has(dataTrack.id));
          });

          it('does not emit a "trackSubscriptionFailed" event', () => {
            const test = makeTest({ state: 'disconnected' });

            const audioTrack = makeTrackSignaling({ kind: 'audio', shouldSubscriptionFail: true });
            const videoTrack = makeTrackSignaling({ kind: 'video', shouldSubscriptionFail: true });
            const dataTrack = makeTrackSignaling({ kind: 'data', shouldSubscriptionFail: true });

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

    context('"trackRemoved" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('should remove the RemoteTrackPublication for the removed RemoteTrackPublicationSignaling', async () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);

          assert(!test.participant.tracks.has(audioTrack.sid));
          assert(!test.participant.audioTracks.has(audioTrack.sid));
          assert(!test.participant.tracks.has(dataTrack.sid));
          assert(!test.participant.dataTracks.has(dataTrack.sid));
          assert(!test.participant.tracks.has(videoTrack.sid));
          assert(!test.participant.videoTracks.has(videoTrack.sid));
        });

        it('should emit "trackUnpublished" for each removed RemoteTrackPublication', async () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);

          const publications = [];
          test.participant.on('trackUnpublished', publication => publications.push(publication));
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);

          assert.equal(publications.length, 3);
          publications.forEach(publication => {
            assert(publication instanceof {
              audio: RemoteAudioTrackPublication,
              data: RemoteDataTrackPublication,
              video: RemoteVideoTrackPublication
            }[publication.kind]);
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackPublicationSignaling exists in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('calls ._removeTrack on the RemoteParticipant with the RemoteTrack', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            const unsubscribed = [];
            const unsubscribedPublications = [];

            const trackUnsubscribedPromise = new Promise(resolve => {
              function shouldResolve() {
                return unsubscribed.length + unsubscribedPublications.length === 6;
              }
              test.participant.on('trackUnsubscribed', (track, publication) => {
                unsubscribed.push(track);
                unsubscribedPublications.push(publication);
                if (shouldResolve()) {
                  resolve();
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            const unsubscribedEventPromises = [...test.participant.tracks.values()].map(publication => {
              return new Promise(resolve => publication.once('unsubscribed', resolve));
            });

            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);

            return Promise.all([
              trackUnsubscribedPromise,
              ...unsubscribedEventPromises
            ]).then(() => {
              assert.equal(test.tracks[0], unsubscribed[0]);
              assert.equal(test.tracks[1], unsubscribed[1]);
              assert.equal(test.tracks[2], unsubscribed[2]);
              assert.equal(test.participant._tracks.size, 0);
              assert.equal(test.participant._audioTracks.size, 0);
              assert.equal(test.participant._videoTracks.size, 0);
              assert.equal(test.participant._dataTracks.size, 0);
              unsubscribedPublications.forEach((publication, i) => assert.equal(publication.trackSid, unsubscribed[i].sid));
            });
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackPublicationSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest();
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            assert(!test.participant._removeTrack.calledOnce);
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        it('should not remove the RemoteTrackPublication for the removed RemoteParticipantSignaling', async () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          test.signaling.emit('stateChanged', 'disconnected');
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);

          assert(test.participant.tracks.has(audioTrack.sid));
          assert(test.participant.audioTracks.has(audioTrack.sid));
          assert(test.participant.tracks.has(dataTrack.sid));
          assert(test.participant.dataTracks.has(dataTrack.sid));
          assert(test.participant.tracks.has(videoTrack.sid));
          assert(test.participant.videoTracks.has(videoTrack.sid));
        });

        it('should not emit "trackUnpublished" on the RemoteParticipant', async () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          test.signaling.emit('stateChanged', 'disconnected');

          const publications = [];
          test.participant.on('trackUnpublished', publication => publications.push(publication));
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);

          assert.equal(publications.length, 0);
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackPublicationSignaling exists in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest();
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            assert(!test.participant._removeTrack.calledOnce);
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackPublicationSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest();
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            assert(!test.participant._removeTrack.calledOnce);
          });
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('should not call ._removeTrackPublication on the RemoteParticipant', async () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.participant._removeTrackPublication = sinon.spy(() => {});
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);
          sinon.assert.callCount(test.participant._removeTrackPublication, 0);
        });

        it('should not emit "trackUnpublished" on the RemoteParticipant', () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);

          const publications = [];
          test.participant.on('trackUnpublished', publication => publications.push(publication));
          test.signaling.emit('trackRemoved', audioTrack);
          test.signaling.emit('trackRemoved', videoTrack);
          test.signaling.emit('trackRemoved', dataTrack);
          assert.equal(publications.length, 0);
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackPublicationSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest({ state: 'disconnected' });
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            assert(!test.participant._removeTrack.calledOnce);
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
          assert(test.participant.tracks.has(audioTrack.sid));
          assert(test.participant[`${audioTrack.kind}Tracks`].has(audioTrack.sid));
          assert(test.participant.tracks.has(dataTrack.sid));
          assert(test.participant[`${dataTrack.kind}Tracks`].has(dataTrack.sid));
          assert(test.participant.tracks.has(videoTrack.sid));
          assert(test.participant[`${videoTrack.kind}Tracks`].has(videoTrack.sid));
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
              assert.equal(audioTrack.trackTransceiver, test.RemoteAudioTrack.args[0][1]);
              assert.equal(videoTrack.trackTransceiver, test.RemoteVideoTrack.args[0][1]);
              assert.equal(dataTrack.trackTransceiver, test.RemoteDataTrack.args[0][1]);
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
          assert(!test.participant.tracks.has(audioTrack.sid));
          assert(!test.participant[`${audioTrack.kind}Tracks`].has(audioTrack.sid));
          assert(!test.participant.tracks.has(dataTrack.sid));
          assert(!test.participant[`${dataTrack.kind}Tracks`].has(dataTrack.sid));
          assert(!test.participant.tracks.has(videoTrack.sid));
          assert(!test.participant[`${videoTrack.kind}Tracks`].has(videoTrack.sid));
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

  describe('Object.keys', () => {
    let participant;

    before(() => {
      participant = new RemoteParticipant(makeSignaling(), { log });
    });

    it('only returns public properties', () => {
      assert.deepEqual(Object.keys(participant), [
        'audioTracks',
        'dataTracks',
        'identity',
        'networkQualityLevel',
        'networkQualityStats',
        'sid',
        'state',
        'tracks',
        'videoTracks'
      ]);
    });
  });

  describe('#toJSON', () => {
    let participant;

    before(() => {
      participant = new RemoteParticipant(makeSignaling(), { log });
    });

    it('only returns public properties', () => {
      assert.deepEqual(participant.toJSON(), {
        audioTracks: {},
        dataTracks: {},
        identity: participant.identity,
        networkQualityLevel: participant.networkQualityLevel,
        networkQualityStats: participant.networkQualityStats,
        sid: participant.sid,
        state: participant.state,
        tracks: {},
        videoTracks: {}
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

  options.RemoteAudioTrack = sinon.spy(function RemoteAudioTrack(sid, mediaTrackReceiver, isEnabled, setPriorityCallback, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this.kind = mediaTrackReceiver.kind;
    this.mediaStreamTrack = mediaTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : mediaTrackReceiver.id;
    this.sid = sid;
    this.setPriority = setPriorityCallback;
    this._setEnabled = enabled => { this.enabled = enabled; };
    options.tracks.push(this);
  });
  inherits(options.RemoteAudioTrack, EventEmitter);

  options.RemoteVideoTrack = sinon.spy(function RemoteVideoTrack(sid, mediaTrackReceiver, isEnabled, setPriorityCallback, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this.kind = mediaTrackReceiver.kind;
    this.mediaStreamTrack = mediaTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : mediaTrackReceiver.id;
    this.sid = sid;
    this.setPriority = setPriorityCallback;
    this._setEnabled = enabled => { this.enabled = enabled; };
    options.tracks.push(this);
  });
  inherits(options.RemoteVideoTrack, EventEmitter);

  options.RemoteDataTrack = sinon.spy(function RemoteDataTrack(sid, dataTrackReceiver, opts) {
    EventEmitter.call(this);
    this.enabled = true;
    this._dataTrackReceiver = dataTrackReceiver;
    this.kind = dataTrackReceiver.kind;
    this.mediaStreamTrack = dataTrackReceiver.track;
    this.name = opts && opts.name ? opts.name : dataTrackReceiver.id;
    this.sid = sid;
    this._setEnabled = enabled => { this.enabled = enabled; };
    options.tracks.push(this);
  });
  inherits(options.RemoteDataTrack, EventEmitter);

  options.log = log;
  options.signaling = options.signaling || makeSignaling(options);
  options.participant = options.participant || new RemoteParticipant(options.signaling, options);

  return options;
}

function makeSignaling(options) {
  options = options || {};
  const signaling = new EventEmitter();
  signaling.sid = options.sid;
  signaling.identity = options.identity;
  signaling.state = options.state;
  signaling.tracks = options.trackSignalings || [];
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
