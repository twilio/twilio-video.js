'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const RemoteParticipant = require('../../../lib/remoteparticipant');
const { defer, makeUUID } = require('../../../lib/util');

const { a } = require('../../lib/util');
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
            track = new test[`Remote${kind}Track`](trackSignaling.mediaStreamTrackOrDataTrackTransceiver, trackSignaling);
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaStreamTrackOrDataTrackTransceiver, newTrackSignaling);
            test.participant.tracks.set(track.id, track);
            test.participant[`${kind.toLowerCase()}Tracks`].set(track.id, track);
            participantEvents = {};
            trackUnsubscribed = null;
            tracksOnceTrackUnsubscribed = null;
            tracksOnceUnsubscribed = null;
            ['trackAdded', 'trackSubscribed', 'trackRemoved', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => {
                participantEvents[event] = track;
                if (event === 'trackUnsubscribed') {
                  tracksOnceTrackUnsubscribed = Array.from(test.participant.tracks.values());
                }
              });
            });
            track.once('unsubscribed', track => {
              trackUnsubscribed = track;
              tracksOnceUnsubscribed = Array.from(test.participant.tracks.values());
            });
            ret = test.participant[method](newTrack);
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
            ['trackAdded', 'trackSubscribed'].forEach(event => {
              it(`should not emit "${event}"`, () => {
                assert(!participantEvents[event]);
              });
            });
          } else {
            it('should emit "unsubscribed" on the removed RemoteTrack', () => {
              assert.equal(trackUnsubscribed, track);
            });

            it('should have removed the RemoteTrack when the "unsubscribed" event was emitted', () => {
              assert.deepEqual(tracksOnceUnsubscribed, []);
            });

            it('should have removed the RemoteTrack when the "trackUnsubscribed" event was emitted', () => {
              assert.deepEqual(tracksOnceTrackUnsubscribed, []);
            });

            it('should emit "trackRemoved" after "trackUnsubscribed"', () => {
              const events = Object.keys(participantEvents);
              assert(participantEvents.trackRemoved);
              assert(participantEvents.trackUnsubscribed);
              assert(events.indexOf('trackUnsubscribed') < events.indexOf('trackRemoved'));
            });
          }
        });

        context(`when ${a(kind)} Remote${kind}Track with the same .id does not exist in .tracks`, () => {
          before(() => {
            newTrackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaStreamTrackOrDataTrackTransceiver, newTrackSignaling);
            participantEvents = {};
            ['trackAdded', 'trackSubscribed', 'trackRemoved', 'trackUnsubscribed'].forEach(event => {
              test.participant.once(event, track => { participantEvents[event] = track; });
            });
            ret = test.participant[method](newTrack);
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
            it('should emit "trackSubscribed" after "trackAdded"', () => {
              const events = Object.keys(participantEvents);
              assert(participantEvents.trackSubscribed);
              assert(participantEvents.trackAdded);
              assert(events.indexOf('trackAdded') < events.indexOf('trackSubscribed'));
            });
          } else {
            ['trackRemoved', 'trackUnsubscribed'].forEach(event => {
              it(`should not emit "${event}"`, () => {
                assert(!participantEvents[event]);
              });
            });
          }
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

      it('re-emits "disabled" events', () => {
        const track = new EventEmitter();
        let trackDisabled;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert.equal(track, trackDisabled);
      });

      it('re-emits "enabled" events', () => {
        const track = new EventEmitter();
        let trackEnabled;
        const test = makeTest({ tracks: [track] });
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert.equal(track, trackEnabled);
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
    });

    context('when the RemoteParticipant .state transitions to "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        const track = new EventEmitter();
        track._unsubscribe = sinon.spy();
        let trackDimensionsChanged;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => { trackDimensionsChanged = track; });
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "disabled" events', () => {
        const track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        let trackDisabled;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "enabled" events', () => {
        const track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        let trackEnabled;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "message" events', () => {
        const track = new EventEmitter();
         track._unsubscribe = sinon.spy();
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
        track._unsubscribe = sinon.spy();
        let trackStarted;
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => { trackStarted = track; });
        track.emit('started', track);
        assert(!trackStarted);
      });

      it('should call ._unsubscribe on all the Participant\'s RemoteTracks', () => {
        const track = new EventEmitter();
        track._unsubscribe = sinon.spy();
        const test = makeTest({ tracks: [track] });
        test.signaling.emit('stateChanged', 'disconnected');
        sinon.assert.calledOnce( track._unsubscribe);
      });

      it('should emit "trackUnsubscribed" events for all the Participant\'s RemoteTracks', () => {
        const track = new EventEmitter();
        track._unsubscribe = sinon.spy();
        const test = makeTest({ tracks: [track] });
        const unsubscribed = [];
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

      it('does not re-emit "disabled" events', () => {
        const track = new EventEmitter();
        let trackDisabled;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackDisabled', track => { trackDisabled = track; });
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "enabled" events', () => {
        const track = new EventEmitter();
        let trackEnabled;
        const test = makeTest({ tracks: [track], state: 'disconnected' });
        test.participant.once('trackEnabled', track => { trackEnabled = track; });
        track.emit('enabled', track);
        assert(!trackEnabled);
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

    context('"trackAdded" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('calls .getMediaStreamTrackOrDataTrackTransceiver on the RemoteTrackSignaling', () => {
          const test = makeTest();
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          sinon.assert.calledOnce(audioTrack.getMediaStreamTrackOrDataTrackTransceiver);
          sinon.assert.calledOnce(videoTrack.getMediaStreamTrackOrDataTrackTransceiver);
          sinon.assert.calledOnce(dataTrack.getMediaStreamTrackOrDataTrackTransceiver);
        });

        context('if the Promise returned by .getMediaStreamTrackOrDataTrackTransceiver resolves', () => {
          it('constructs a new RemoteTrack and sets its .name to that of the underlying RemoteTrackSignaling', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);
              assert.equal(audioTrack.name, test.tracks[0].name);

              assert.equal(videoTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);
              assert.equal(videoTrack.name, test.tracks[1].name);

              assert.equal(dataTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteDataTrack.args[0][0]);
              assert.equal(dataTrack, test.RemoteDataTrack.args[0][1]);
              assert.equal(dataTrack.name, test.tracks[2].name);
            });
          });

          it('adds the newly-constructed RemoteTrack to the RemoteParticipant\'s RemoteTrack collections', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert.equal(test.tracks[0], test.participant.tracks.get(test.tracks[0].id));
              assert.equal(test.tracks[1], test.participant.tracks.get(test.tracks[1].id));
              assert.equal(test.tracks[2], test.participant.tracks.get(test.tracks[2].id));
              assert.equal(test.tracks[0], test.participant.audioTracks.get(test.tracks[0].id));
              assert.equal(test.tracks[1], test.participant.videoTracks.get(test.tracks[1].id));
              assert.equal(test.tracks[2], test.participant.dataTracks.get(test.tracks[2].id));
            });
          });


          it('fires the "trackAdded" and "trackSubscribed" events on the RemoteParticipant', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            const tracks = [];
            const subscribed = [];

            const trackEventsPromise = new Promise(resolve => {
              function shouldResolve() {
                return tracks.length + subscribed.length === 4;
              }
              test.participant.on('trackAdded', track => {
                tracks.push(track);
                if (shouldResolve()) {
                  resolve();
                }
              });
              test.participant.on('trackSubscribed', track => {
                subscribed.push(track);
                if (shouldResolve()) {
                  resolve();
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            return Promise.all([
              trackEventsPromise,
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert.equal(test.tracks[0], tracks[0]);
              assert.equal(test.tracks[1], tracks[1]);
              assert.equal(test.tracks[2], tracks[2]);
              assert.equal(test.tracks[0], subscribed[0]);
              assert.equal(test.tracks[1], subscribed[1]);
              assert.equal(test.tracks[2], subscribed[2]);
            });
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        it('does not call .getMediaStreamTrackOrDataTrackTransceiver on the RemoteTrackSignaling', () => {
          const test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!audioTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!videoTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!dataTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
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
        it('does not call .getMediaStreamTrackOrDataTrackTransceiver on the RemoteTrackSignaling', () => {
          const test = makeTest({ state: 'disconnected' });
          const audioTrack = makeTrackSignaling({ kind: 'audio' });
          const videoTrack = makeTrackSignaling({ kind: 'video' });
          const dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!audioTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!videoTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!dataTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
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

    context('"trackRemoved" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling exists in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('calls ._removeTrack on the RemoteParticipant with the RemoteTrack', () => {
            const test = makeTest();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            const tracks = [];
            const unsubscribed = [];

            const trackEventsPromise = new Promise(resolve => {
              function shouldResolve() {
                return tracks.length + unsubscribed.length === 4;
              }
              test.participant.on('trackRemoved', track => {
                tracks.push(track);
                if (shouldResolve()) {
                  resolve();
                }
              });
              test.participant.on('trackUnsubscribed', track => {
                unsubscribed.push(track);
                if (shouldResolve()) {
                  resolve();
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            const unsubscribedEventPromises = [...test.participant.tracks.values()].map(track => {
              return new Promise(resolve => track.once('unsubscribed', resolve));
            });

            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);

            return Promise.all([
              trackEventsPromise,
              ...unsubscribedEventPromises,
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert.equal(test.tracks[0], tracks[0]);
              assert.equal(test.tracks[1], tracks[1]);
              assert.equal(test.tracks[2], tracks[2]);
              assert.equal(test.tracks[0], unsubscribed[0]);
              assert.equal(test.tracks[1], unsubscribed[1]);
              assert.equal(test.tracks[2], unsubscribed[2]);
              assert.equal(test.participant.tracks.size, 0);
              assert.equal(test.participant.audioTracks.size, 0);
              assert.equal(test.participant.videoTracks.size, 0);
              assert.equal(test.participant.dataTracks.size, 0);
            });
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest();
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling exists in the RemoteParticipant\'s RemoteTrack collections', () => {
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
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
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
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            const test = makeTest({ state: 'disconnected' });
            test.participant._removeTrack = sinon.spy();
            const audioTrack = makeTrackSignaling({ kind: 'audio' });
            const videoTrack = makeTrackSignaling({ kind: 'video' });
            const dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('calls .getMediaStreamTrackOrDataTrackTransceiver on each RemoteTrackSignaling', () => {
          const test = makeTest({
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          assert(audioTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(videoTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
        });

        context('if the Promise returned by .getMediaStreamTrackOrDataTrackTransceiver resolves', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the RemoteTrackSignaling\'s .kind', () => {
            const test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' },
                { kind: 'data' }
              ]
            });
            const audioTrack = test.trackSignalings[0];
            const videoTrack = test.trackSignalings[1];
            const dataTrack = test.trackSignalings[2];
            return Promise.all([
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);

              assert.equal(videoTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);

              assert.equal(dataTrack.mediaStreamTrackOrDataTrackTransceiver, test.RemoteDataTrack.args[0][0]);
              assert.equal(dataTrack, test.RemoteDataTrack.args[0][1]);
            });
          });

          it('calls ._addTrack on the RemoteParticipant with the newly-constructed RemoteTrack', () => {
            const test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' },
                { kind: 'data' }
              ]
            });
            const tracksAddedPromise = new Promise(resolve => {
              const tracks = [];
              test.participant.on('trackAdded', track => {
                tracks.push(track);
                if (tracks.length === 2) {
                  resolve(tracks);
                }
              });
            });

            const audioTrack = test.trackSignalings[0];
            const videoTrack = test.trackSignalings[1];
            const dataTrack = test.trackSignalings[2];

            return Promise.all([
              tracksAddedPromise,
              audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
              dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
              assert.equal(test.tracks[2], results[0][2]);
            });
          });
        });
      });

      context('when the RemoteParticipant .state beings in "disconnected"', () => {
        it('does not call .getMediaStreamTrackOrDataTrackTransceiver on each RemoteTrackSignaling', () => {
          const test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          const dataTrack = test.trackSignalings[1];
          assert(!audioTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!videoTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
          assert(!dataTrack.getMediaStreamTrackOrDataTrackTransceiver.calledOnce);
        });

        it('does not construct new RemoteTracks', () => {
          const test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          const dataTrack = test.trackSignalings[1];
          return Promise.all([
            audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
            videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
            dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
          ]).then(() => {
            assert.equal(0, test.tracks.length);
          });
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          const test = makeTest({
            participant: { _addTrack: sinon.spy() },
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          const audioTrack = test.trackSignalings[0];
          const videoTrack = test.trackSignalings[1];
          const dataTrack = test.trackSignalings[2];
          return Promise.all([
            audioTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
            videoTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise,
            dataTrack.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise
          ]).then(() => {
            assert(!test.participant._addTrack.calledOnce);
          });
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
      trackSignalings.push(makeTrackSignaling());
    }
    options.trackSignalings = trackSignalings;
  }
  options.trackSignalings = options.trackSignalings ? options.trackSignalings.map(makeTrackSignaling) : [];

  options.RemoteAudioTrack = sinon.spy(function RemoteAudioTrack(mediaStreamTrack, signaling) {
    EventEmitter.call(this);
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.mediaStreamTrack = mediaStreamTrack;
    this.name = signaling.name;
    this.signaling = signaling;
    this._unsubscribe = this.emit.bind(this, 'unsubscribed', this);
    options.tracks.push(this);
  });
  inherits(options.RemoteAudioTrack, EventEmitter);

  options.RemoteVideoTrack = sinon.spy(function RemoteVideoTrack(mediaStreamTrack, signaling) {
    EventEmitter.call(this);
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.mediaStreamTrack = mediaStreamTrack;
    this.name = signaling.name;
    this.signaling = signaling;
    this._unsubscribe = this.emit.bind(this, 'unsubscribed', this);
    options.tracks.push(this);
  });
  inherits(options.RemoteVideoTrack, EventEmitter);

  options.RemoteDataTrack = sinon.spy(function RemoteDataTrack(dataTrackReceiver, signaling) {
    EventEmitter.call(this);
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.name = signaling.name;
    this._dataTrackReceiver = dataTrackReceiver;
    this.signaling = signaling;
    this._unsubscribe = this.emit.bind(this, 'unsubscribed', this);
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

function makeTrackSignaling(options) {
  options = options || {};
  const track = new EventEmitter();
  track.id = options.id || makeId();
  track.kind = options.kind || makeKind();
  track.name = options.name || track.id;
  track.mediaStreamTrackOrDataTrackTransceiver = { id: track.id, kind: track.kind };
  track.mediaStream = {};
  track.getMediaStreamTrackOrDataTrackTransceiverDeferred = defer();
  track.getMediaStreamTrackOrDataTrackTransceiverDeferred.resolve(track.mediaStreamTrackOrDataTrackTransceiver);
  track.getMediaStreamTrackOrDataTrackTransceiver = sinon.spy(() => track.getMediaStreamTrackOrDataTrackTransceiverDeferred.promise);
  return track;
}
