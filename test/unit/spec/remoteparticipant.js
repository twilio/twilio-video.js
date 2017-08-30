'use strict';

var a = require('../../lib/util').a;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var RemoteParticipant = require('../../../lib/remoteparticipant');
var inherits = require('util').inherits;
var sinon = require('sinon');
var util = require('../../../lib/util');
var log = require('../../lib/fakelog');

describe('RemoteParticipant', function() {
  describe('constructor', () => {
    it('sets .identity to the RemoteParticipantSignaling\'s .identity', () => {
      var test = makeTest();
      assert.equal(test.identity, test.participant.identity);
    });

    it('sets .sid to the RemoteParticipantSignaling\'s .sid', () => {
      var test = makeTest();
      assert.equal(test.sid, test.participant.sid);
    });

    it('sets .state to the RemoteParticipantSignaling\'s .state', () => {
      var test = makeTest();
      assert.equal(test.state, test.participant.state);
    });

    context('when RemoteTracks are provided', () => {
      var test;
      var audioTrack;
      var videoTrack;
      var dataTrack;

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

        test = makeTest({ tracks: [ audioTrack, videoTrack, dataTrack ] });
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
      var test;

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
    [ '_addTrack', 'add' , 'to' ],
    [ '_removeTrack', 'remove', 'from' ]
  ].forEach(([ method, action, toOrFrom ]) => {
    describe(`#${method}`, () => {
      var newTrack;
      var newTrackSignaling;
      var participantEvents;
      var ret;
      var test;
      var trackSignaling;
      var trackUnsubscribed;
      var track;

      before(() => {
        test = makeTest();
      });

      [ 'Audio', 'Video', 'Data' ].forEach(kind => {
        context(`when ${a(kind)} Remote${kind}Track with the same .id exists in .tracks`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrackSignaling = makeTrackSignaling({ id: trackSignaling.id, kind: kind.toLowerCase() });
            track = new test[`Remote${kind}Track`](trackSignaling.mediaOrDataStreamTrack, trackSignaling);
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaOrDataStreamTrack, newTrackSignaling);
            test.participant.tracks.set(track.id, track);
            test.participant[`${kind.toLowerCase()}Tracks`].set(track.id, track);
            participantEvents = {};
            trackUnsubscribed = null;
            [ 'trackAdded', 'trackSubscribed', 'trackRemoved', 'trackUnsubscribed' ].forEach(event => {
              test.participant.once(event, track => participantEvents[event] = track);
            });
            track.once('unsubscribed', track => trackUnsubscribed = track);
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
            [ 'trackAdded', 'trackSubscribed' ].forEach(event => {
              it(`should not emit "${event}"`, () => {
                assert(!participantEvents[event]);
              });
            });
          } else {
            it('should emit "unsubscribed" on the removed RemoteTrack', () => {
              assert.equal(trackUnsubscribed, track);
            });

            it('should emit "trackRemoved" after "trackUnsubscribed"', () => {
              var events = Object.keys(participantEvents);
              assert(participantEvents['trackRemoved']);
              assert(participantEvents['trackUnsubscribed']);
              assert(events.indexOf('trackUnsubscribed') < events.indexOf('trackRemoved'));
            });
          }
        });

        context(`when ${a(kind)} Remote${kind}Track with the same .id does not exist in .tracks`, () => {
          before(() => {
            newTrackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaOrDataStreamTrack, newTrackSignaling);
            participantEvents = {};
            [ 'trackAdded', 'trackSubscribed', 'trackRemoved', 'trackUnsubscribed' ].forEach(event => {
              test.participant.once(event, track => participantEvents[event] = track);
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
              var events = Object.keys(participantEvents);
              assert(participantEvents['trackSubscribed']);
              assert(participantEvents['trackAdded']);
              assert(events.indexOf('trackAdded') < events.indexOf('trackSubscribed'));
            });
          } else {
            [ 'trackRemoved', 'trackUnsubscribed' ].forEach(event => {
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
        var track = new EventEmitter();
        var trackDimensionsChanged;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        track.emit('dimensionsChanged', track);
        assert.equal(track, trackDimensionsChanged);
      });

      it('re-emits "disabled" events', () => {
        var track = new EventEmitter();
        var trackDisabled;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackDisabled', track => trackDisabled = track);
        track.emit('disabled', track);
        assert.equal(track, trackDisabled);
      });

      it('re-emits "enabled" events', () => {
        var track = new EventEmitter();
        var trackEnabled;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackEnabled', track => trackEnabled = track);
        track.emit('enabled', track);
        assert.equal(track, trackEnabled);
      });

      it('re-emits "message" events', () => {
        var track = new EventEmitter();
        var trackMessageEvent;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackMessage', (data, track) => trackMessageEvent = { data, track });
        var data = util.makeUUID();
        track.emit('message', data, track);
        assert.equal(data, trackMessageEvent.data);
        assert.equal(track, trackMessageEvent.track);
      });

      it('re-emits "started" events', () => {
        var track = new EventEmitter();
        var trackStarted;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackStarted', track => trackStarted = track);
        track.emit('started', track);
        assert.equal(track, trackStarted);
      });
    });

    context('when the RemoteParticipant .state transitions to "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var trackDimensionsChanged;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "disabled" events', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var trackDisabled;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDisabled', track => trackDisabled = track);
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "enabled" events', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var trackEnabled;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackEnabled', track => trackEnabled = track);
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "message" events', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var trackMessageEvent;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackMessage', (data, track) => trackMessageEvent = { data, track });
        var data = util.makeUUID();
        track.emit('message', data, track);
        assert(!trackMessageEvent);
      });

      it('does not re-emit "started" events', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var trackStarted;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => trackStarted = track);
        track.emit('started', track);
        assert(!trackStarted);
      });

      it('should call ._unsubscribe on all the Participant\'s RemoteTracks', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        sinon.assert.calledOnce( track._unsubscribe);
      });

      it('should emit "trackUnsubscribed" events for all the Participant\'s RemoteTracks', () => {
        var track = new EventEmitter();
         track._unsubscribe = sinon.spy();
        var test = makeTest({ tracks: [ track ] });
        var unsubscribed = [];
        test.participant.on('trackUnsubscribed', track => unsubscribed.push(track));
        test.signaling.emit('stateChanged', 'disconnected');
        assert.equal(unsubscribed.length, 1);
        assert.equal(unsubscribed[0], track);
      });
    });

    context('when the RemoteParticipant .state begins in "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        var track = new EventEmitter();
        var trackDimensionsChanged;
        var test = makeTest({ tracks: [ track ], state: 'disconnected' });
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "disabled" events', () => {
        var track = new EventEmitter();
        var trackDisabled;
        var test = makeTest({ tracks: [ track ], state: 'disconnected' });
        test.participant.once('trackDisabled', track => trackDisabled = track);
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "enabled" events', () => {
        var track = new EventEmitter();
        var trackEnabled;
        var test = makeTest({ tracks: [ track ], state: 'disconnected' });
        test.participant.once('trackEnabled', track => trackEnabled = track);
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "message" events', () => {
        var track = new EventEmitter();
        var trackMessageEvent;
        var test = makeTest({ tracks: [ track ], state: 'disconnected' });
        test.participant.once('trackMessage', (data, track) => trackMessageEvent = { data, track });
        var data = util.makeUUID();
        track.emit('message', data, track);
        assert(!trackMessageEvent);
      });

      it('does not re-emit "started" events', () => {
        var track = new EventEmitter();
        var trackStarted;
        var test = makeTest({ tracks: [ track ], state: 'disconnected' });
        test.participant.once('trackStarted', track => trackStarted = track);
        track.emit('started', track);
        assert(!trackStarted);
      });
    });
  });

  describe('RemoteParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('re-emits the "disconnected" state event', () => {
          var test = makeTest();
          var disconnected;
          test.participant.once('disconnected', participant => disconnected = participant);
          test.signaling.emit('stateChanged', 'disconnected');
          assert.equal(test.participant, disconnected);
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        it('re-emits the "disconnected" state event', () => {
          var test = makeTest();
          var disconnected;
          test.signaling.emit('stateChanged', 'disconnected');
          test.participant.once('disconnected', () => disconnected = true);
          test.signaling.emit('stateChanged', 'disconnected');
          assert(!disconnected);
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('re-emits the "disconnected" state event', () => {
          var test = makeTest({ state: 'disconnected' });
          var disconnected;
          test.participant.once('disconnected', () => disconnected = true);
          test.signaling.emit('stateChanged', 'disconnected');
          assert(!disconnected);
        });
      });
    });

    context('"trackAdded" event', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('calls .getMediaOrDataStreamTrack on the RemoteTrackSignaling', () => {
          var test = makeTest();
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          sinon.assert.calledOnce(audioTrack.getMediaOrDataStreamTrack);
          sinon.assert.calledOnce(videoTrack.getMediaOrDataStreamTrack);
          sinon.assert.calledOnce(dataTrack.getMediaOrDataStreamTrack);
        });

        context('if the Promise returned by .getMediaOrDataStreamTrack resolves', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the RemoteTrackSignaling\'s .kind', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaOrDataStreamTrack, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);

              assert.equal(videoTrack.mediaOrDataStreamTrack, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);

              assert.equal(dataTrack.mediaOrDataStreamTrack, test.RemoteDataTrack.args[0][0]);
              assert.equal(dataTrack, test.RemoteDataTrack.args[0][1]);
            });
          });

          it('adds the newly-constructed RemoteTrack to the RemoteParticipant\'s RemoteTrack collections', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
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
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            var tracks = [];
            var subscribed = [];

            var trackEventsPromise = new Promise(resolve => {
              var shouldResolve = () => tracks.length + subscribed.length === 4;
              test.participant.on('trackAdded', track => {
                tracks.push(track);
                shouldResolve() && resolve();
              });
              test.participant.on('trackSubscribed', track => {
                subscribed.push(track);
                shouldResolve() && resolve();
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            return Promise.all([
              trackEventsPromise,
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
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
        it('does not call .getMediaOrDataStreamTrack on the RemoteTrackSignaling', () => {
          var test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!audioTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!videoTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!dataTrack.getMediaOrDataStreamTrack.calledOnce);
        });

        it('does not construct a new RemoteTrack', () => {
          var test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
          assert(!test.RemoteDataTrack.calledOnce);
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          var test = makeTest();
          test.participant._addTrack = sinon.spy();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.participant._addTrack.calledOnce);
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        it('does not call .getMediaOrDataStreamTrack on the RemoteTrackSignaling', () => {
          var test = makeTest({ state: 'disconnected' });
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!audioTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!videoTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!dataTrack.getMediaOrDataStreamTrack.calledOnce);
        });

        it('does not construct a new RemoteTrack', () => {
          var test = makeTest({ state: 'disconnected' });
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          test.signaling.emit('trackAdded', dataTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
          assert(!test.RemoteDataTrack.calledOnce);
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          var test = makeTest({ state: 'disconnected' });
          test.participant._addTrack = sinon.spy();
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          var dataTrack = makeTrackSignaling({ kind: 'data' });
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
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            var tracks = [];
            var unsubscribed = [];

            var trackEventsPromise = new Promise(resolve => {
              var shouldResolve = () => tracks.length + unsubscribed.length === 4;
              test.participant.on('trackRemoved', track => {
                tracks.push(track);
                shouldResolve() && resolve();
              });
              test.participant.on('trackUnsubscribed', track => {
                unsubscribed.push(track);
                shouldResolve() && resolve();
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);

            var unsubscribedEventPromises = [...test.participant.tracks.values()].map(track => {
              return new Promise(resolve => track.once('unsubscribed', resolve));
            });

            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);

            return Promise.all([
              trackEventsPromise,
              ...unsubscribedEventPromises,
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
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
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the RemoteParticipant .state transitions to "disconnected"', () => {
        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling exists in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackAdded', dataTrack);
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });

        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the RemoteParticipant .state begins in "disconnected"', () => {
        context('and a RemoteTrack with an .id matching that of the RemoteTrackSignaling does not exist in the RemoteParticipant\'s RemoteTrack collections', () => {
          it('does not call ._removeTrack on the RemoteParticipant', () => {
            var test = makeTest({ state: 'disconnected' });
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            var dataTrack = makeTrackSignaling({ kind: 'data' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            test.signaling.emit('trackRemoved', dataTrack);
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the RemoteParticipant .state begins in "connected"', () => {
        it('calls .getMediaOrDataStreamTrack on each RemoteTrackSignaling', () => {
          var test = makeTest({
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          assert(audioTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(videoTrack.getMediaOrDataStreamTrack.calledOnce);
        });

        context('if the Promise returned by .getMediaOrDataStreamTrack resolves', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the RemoteTrackSignaling\'s .kind', () => {
            var test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' },
                { kind: 'data' }
              ]
            });
            var audioTrack = test.trackSignalings[0];
            var videoTrack = test.trackSignalings[1];
            var dataTrack = test.trackSignalings[2];
            return Promise.all([
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaOrDataStreamTrack, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);

              assert.equal(videoTrack.mediaOrDataStreamTrack, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);

              assert.equal(dataTrack.mediaOrDataStreamTrack, test.RemoteDataTrack.args[0][0]);
              assert.equal(dataTrack, test.RemoteDataTrack.args[0][1]);
            });
          });

          it('calls ._addTrack on the RemoteParticipant with the newly-constructed RemoteTrack', () => {
            var test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' },
                { kind: 'data' }
              ]
            });
            var tracksAddedPromise = new Promise(resolve => {
              var tracks = [];
              test.participant.on('trackAdded', track => {
                tracks.push(track);
                if (tracks.length === 2) {
                  resolve(tracks);
                }
              });
            });

            var audioTrack = test.trackSignalings[0];
            var videoTrack = test.trackSignalings[1];
            var dataTrack = test.trackSignalings[2];

            return Promise.all([
              tracksAddedPromise,
              audioTrack.getMediaOrDataStreamTrackDeferred.promise,
              videoTrack.getMediaOrDataStreamTrackDeferred.promise,
              dataTrack.getMediaOrDataStreamTrackDeferred.promise
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
              assert.equal(test.tracks[2], results[0][2]);
            });
          });
        });
      });

      context('when the RemoteParticipant .state beings in "disconnected"', () => {
        it('does not call .getMediaOrDataStreamTrack on each RemoteTrackSignaling', () => {
          var test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          var dataTrack = test.trackSignalings[1];
          assert(!audioTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!videoTrack.getMediaOrDataStreamTrack.calledOnce);
          assert(!dataTrack.getMediaOrDataStreamTrack.calledOnce);
        });

        it('does not construct new RemoteTracks', () => {
          var test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          var dataTrack = test.trackSignalings[1];
          return Promise.all([
            audioTrack.getMediaOrDataStreamTrackDeferred.promise,
            videoTrack.getMediaOrDataStreamTrackDeferred.promise,
            dataTrack.getMediaOrDataStreamTrackDeferred.promise
          ]).then(() => {
            assert.equal(0, test.tracks.length);
          });
        });

        it('does not call ._addTrack on the RemoteParticipant', () => {
          var test = makeTest({
            participant: { _addTrack: sinon.spy() },
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' },
              { kind: 'data' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          var dataTrack = test.trackSignalings[2];
          return Promise.all([
            audioTrack.getMediaOrDataStreamTrackDeferred.promise,
            videoTrack.getMediaOrDataStreamTrackDeferred.promise,
            dataTrack.getMediaOrDataStreamTrackDeferred.promise
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
  var sid = 'PA';
  for (var i = 0; i < 32; i++) {
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
    var trackSignalings = [];
    for (var i = 0; i < options.trackSignalings; i++) {
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
    this.signaling = signaling;
    this._unsubscribe = this.emit.bind(this, 'unsubscribed', this);
    options.tracks.push(this);
  });
  inherits(options.RemoteVideoTrack, EventEmitter);

  options.RemoteDataTrack = sinon.spy(function RemoteDataTrack(dataStreamTrack, signaling) {
    EventEmitter.call(this);
    this.id = signaling.id;
    this.kind = signaling.kind;
    this._dataStreamTrack = dataStreamTrack;
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
  var signaling = new EventEmitter();
  signaling.sid = options.sid;
  signaling.identity = options.identity;
  signaling.state = options.state;
  signaling.tracks = options.trackSignalings;
  return signaling;
}

function makeId() {
  return util.makeUUID();
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeTrackSignaling(options) {
  options = options || {};
  var track = new EventEmitter();
  track.id = options.id || makeId();
  track.kind = options.kind || makeKind();
  track.mediaOrDataStreamTrack = { id: track.id, kind: track.kind };
  track.mediaStream = {};
  track.getMediaOrDataStreamTrackDeferred = util.defer();
  track.getMediaOrDataStreamTrackDeferred.resolve(track.mediaOrDataStreamTrack);
  track.getMediaOrDataStreamTrack = sinon.spy(() => track.getMediaOrDataStreamTrackDeferred.promise);
  return track;
}
