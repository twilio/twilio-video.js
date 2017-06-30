'use strict';

var a = require('../../lib/util').a;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Participant = require('../../../lib/participant');
var inherits = require('util').inherits;
var sinon = require('sinon');
var util = require('../../../lib/util');
var log = require('../../lib/fakelog');

describe('Participant', function() {
  describe('constructor', () => {
    it('sets .identity to the ParticipantSignaling\'s .identity', () => {
      var test = makeTest();
      assert.equal(test.identity, test.participant.identity);
    });

    it('sets .sid to the ParticipantSignaling\'s .sid', () => {
      var test = makeTest();
      assert.equal(test.sid, test.participant.sid);
    });

    it('sets .state to the ParticipantSignaling\'s .state', () => {
      var test = makeTest();
      assert.equal(test.state, test.participant.state);
    });

    context('when Tracks are provided', () => {
      var test;
      var audioTrack;
      var videoTrack;

      before(() => {
        audioTrack = new EventEmitter();
        audioTrack.id = 'audioTrack';
        audioTrack.kind = 'audio';

        videoTrack = new EventEmitter();
        videoTrack.id = 'videoTrack';
        videoTrack.kind = 'video';

        test = makeTest({ tracks: [ audioTrack, videoTrack ] });
      });

      it('should set .tracks to a Map of Track ID => Track', () => {
        assert.equal(test.participant.tracks.size, 2);
        test.participant.tracks.forEach(track => {
          assert.equal(track, track.kind === 'audio' ? audioTrack : videoTrack);
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
    });

    context('when Tracks are not provided', () => {
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
    });
  });

  [
    [ '_addTrack', 'add' , 'to' ],
    [ '_removeTrack', 'remove', 'from' ]
  ].forEach(([ method, action, toOrFrom ]) => {
    describe(`#${method}`, () => {
      var newTrack;
      var newTrackSignaling;
      var ret;
      var test;
      var trackSignaling;
      var track;

      before(() => {
        test = makeTest();
      });

      [ 'Audio', 'Video' ].forEach(kind => {
        context(`when ${a(kind)} Remote${kind}Track with the same .id exists in .tracks`, () => {
          before(() => {
            trackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrackSignaling = makeTrackSignaling({ id: trackSignaling.id, kind: kind.toLowerCase() });
            track = new test[`Remote${kind}Track`](trackSignaling.mediaStreamTrack, trackSignaling);
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaStreamTrack, newTrackSignaling);
            test.participant.tracks.set(track.id, track);
            test.participant[`${kind.toLowerCase()}Tracks`].set(track.id, track);
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
        });

        context(`when ${a(kind)} Remote${kind}Track with the same .id does not exist in .tracks`, () => {
          before(() => {
            newTrackSignaling = makeTrackSignaling({ kind: kind.toLowerCase() });
            newTrack = new test[`Remote${kind}Track`](newTrackSignaling.mediaStreamTrack, newTrackSignaling);
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
        });
      });
    });
  });

  describe('.tracks', () => {
    context('when the Participant begins in .state "connected"', () => {
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

      it('re-emits "started" events', () => {
        var track = new EventEmitter();
        var trackStarted;
        var test = makeTest({ tracks: [ track ] });
        test.participant.once('trackStarted', track => trackStarted = track);
        track.emit('started', track);
        assert.equal(track, trackStarted);
      });
    });

    context('when the Participant .state transitions to "disconnected"', () => {
      it('does not re-emit "dimensionsChanged" events', () => {
        var track = new EventEmitter();
        var trackDimensionsChanged;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        track.emit('dimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "disabled" events', () => {
        var track = new EventEmitter();
        var trackDisabled;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDisabled', track => trackDisabled = track);
        track.emit('disabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "enabled" events', () => {
        var track = new EventEmitter();
        var trackEnabled;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackEnabled', track => trackEnabled = track);
        track.emit('enabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "started" events', () => {
        var track = new EventEmitter();
        var trackStarted;
        var test = makeTest({ tracks: [ track ] });
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => trackStarted = track);
        track.emit('started', track);
        assert(!trackStarted);
      });
    });

    context('when the Participant .state begins in "disconnected"', () => {
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

  describe('ParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the Participant .state begins in "connected"', () => {
        it('re-emits the "disconnected" state event', () => {
          var test = makeTest();
          var disconnected;
          test.participant.once('disconnected', participant => disconnected = participant);
          test.signaling.emit('stateChanged', 'disconnected');
          assert.equal(test.participant, disconnected);
        });
      });

      context('when the Participant .state transitions to "disconnected"', () => {
        it('re-emits the "disconnected" state event', () => {
          var test = makeTest();
          var disconnected;
          test.signaling.emit('stateChanged', 'disconnected');
          test.participant.once('disconnected', () => disconnected = true);
          test.signaling.emit('stateChanged', 'disconnected');
          assert(!disconnected);
        });
      });

      context('when the Participant .state begins in "disconnected"', () => {
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
      context('when the Participant .state begins in "connected"', () => {
        it('calls .getMediaStreamTrack on the TrackSignaling', () => {
          var test = makeTest();
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(
            audioTrack.id,
            audioTrack.getMediaStreamTrack.args[0][0]);
          assert(
            videoTrack.id,
            videoTrack.getMediaStreamTrack.args[0][0]);
        });

        context('if the Promise returned by .getMediaStreamTrack resolves', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the TrackSignaling\'s .kind', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaStreamTrack, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);

              assert.equal(videoTrack.mediaStreamTrack, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);
            });
          });

          it('adds the newly-constructed Track to the Participant\'s Track collections', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(test.tracks[0], test.participant.tracks.get(test.tracks[0].id));
              assert.equal(test.tracks[1], test.participant.tracks.get(test.tracks[1].id));
              assert.equal(test.tracks[0], test.participant.audioTracks.get(test.tracks[0].id));
              assert.equal(test.tracks[1], test.participant.videoTracks.get(test.tracks[1].id));
            });
          });

          it('fires the "trackAdded" event on the Participant', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });

            var tracksAddedPromise = new Promise(resolve => {
              var tracks = [];
              test.participant.on('trackAdded', track => {
                tracks.push(track);
                if (tracks.length === 2) {
                  resolve(tracks);
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);

            return Promise.all([
              tracksAddedPromise,
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
            });
          });
        });
      });

      context('when the Participant .state transitions to "disconnected"', () => {
        it('does not call .getMediaStreamTrack on the TrackSignaling', () => {
          var test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!audioTrack.getMediaStreamTrack.calledOnce);
          assert(!videoTrack.getMediaStreamTrack.calledOnce);
        });

        it('does not construct a new Track', () => {
          var test = makeTest();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
        });

        it('does not call ._addTrack on the Participant', () => {
          var test = makeTest();
          test.participant._addTrack = sinon.spy();
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.participant._addTrack.calledOnce);
        });
      });

      context('when the Participant .state begins in "disconnected"', () => {
        it('does not call .getMediaStreamTrack on the TrackSignaling', () => {
          var test = makeTest({ state: 'disconnected' });
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!audioTrack.getMediaStreamTrack.calledOnce);
          assert(!videoTrack.getMediaStreamTrack.calledOnce);
        });

        it('does not construct a new Track', () => {
          var test = makeTest({ state: 'disconnected' });
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.RemoteAudioTrack.calledOnce);
          assert(!test.RemoteVideoTrack.calledOnce);
        });

        it('does not call ._addTrack on the Participant', () => {
          var test = makeTest({ state: 'disconnected' });
          test.participant._addTrack = sinon.spy();
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.participant._addTrack.calledOnce);
        });
      });
    });

    context('"trackRemoved" event', () => {
      context('when the Participant .state begins in "connected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling exists in the Participant\'s Track collections', () => {
          it('calls ._removeTrack on the Participant with the Track', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });

            var tracksRemovedPromise = new Promise(resolve => {
              var tracks = [];
              test.participant.on('trackRemoved', track => {
                tracks.push(track);
                if (tracks.length === 2) {
                  resolve(tracks);
                }
              });
            });

            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);

            return Promise.all([
              tracksRemovedPromise,
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
              assert.equal(test.participant.tracks.size, 0);
              assert.equal(test.participant.audioTracks.size, 0);
              assert.equal(test.participant.videoTracks.size, 0);
            });
          });
        });

        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Track collections', () => {
          it('does not call ._removeTrack on the Participant', () => {
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the Participant .state transitions to "disconnected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling exists in the Participant\'s Track collections', () => {
          it('does not call ._removeTrack on the Participant', () => {
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });

        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Track collections', () => {
          it('does not call ._removeTrack on the Participant', () => {
            var test = makeTest();
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the Participant .state begins in "disconnected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Track collections', () => {
          it('does not call ._removeTrack on the Participant', () => {
            var test = makeTest({ state: 'disconnected' });
            test.participant._removeTrack = sinon.spy();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.participant._removeTrack.calledOnce);
            });
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the Participant .state begins in "connected"', () => {
        it('calls .getMediaStreamTrack on each TrackSignaling', () => {
          var test = makeTest({
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          assert(audioTrack.getMediaStreamTrack.calledOnce);
          assert(videoTrack.getMediaStreamTrack.calledOnce);
        });

        context('if the Promise returned by .getMediaStreamTrack resolves', () => {
          it('constructs a new RemoteAudioTrack or RemoteVideoTrack, depending on the TrackSignaling\'s .kind', () => {
            var test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' }
              ]
            });
            var audioTrack = test.trackSignalings[0];
            var videoTrack = test.trackSignalings[1];
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaStreamTrack, test.RemoteAudioTrack.args[0][0]);
              assert.equal(audioTrack, test.RemoteAudioTrack.args[0][1]);

              assert.equal(videoTrack.mediaStreamTrack, test.RemoteVideoTrack.args[0][0]);
              assert.equal(videoTrack, test.RemoteVideoTrack.args[0][1]);
            });
          });

          it('calls ._addTrack on the Participant with the newly-constructed Track', () => {
            var test = makeTest({
              trackSignalings: [
                { kind: 'audio' },
                { kind: 'video' }
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

            return Promise.all([
              tracksAddedPromise,
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(results => {
              assert.equal(test.tracks[0], results[0][0]);
              assert.equal(test.tracks[1], results[0][1]);
            });
          });
        });
      });

      context('when the Participant .state beings in "disconnected"', () => {
        it('does not call .getMediaStreamTrack on each TrackSignaling', () => {
          var test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          assert(!audioTrack.getMediaStreamTrack.calledOnce);
          assert(!videoTrack.getMediaStreamTrack.calledOnce);
        });

        it('does not construct new Tracks', () => {
          var test = makeTest({
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          return Promise.all([
            audioTrack.getMediaStreamTrackDeferred.promise,
            videoTrack.getMediaStreamTrackDeferred.promise
          ]).then(() => {
            assert.equal(0, test.tracks.length);
          });
        });

        it('does not call ._addTrack on the Participant', () => {
          var test = makeTest({
            participant: { _addTrack: sinon.spy() },
            state: 'disconnected',
            trackSignalings: [
              { kind: 'audio' },
              { kind: 'video' }
            ]
          });
          var audioTrack = test.trackSignalings[0];
          var videoTrack = test.trackSignalings[1];
          return Promise.all([
            audioTrack.getMediaStreamTrackDeferred.promise,
            videoTrack.getMediaStreamTrackDeferred.promise
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
    options.tracks.push(this);
  });
  inherits(options.RemoteAudioTrack, EventEmitter);

  options.RemoteVideoTrack = sinon.spy(function RemoteVideoTrack(mediaStreamTrack, signaling) {
    EventEmitter.call(this);
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.mediaStreamTrack = mediaStreamTrack;
    this.signaling = signaling;
    options.tracks.push(this);
  });
  inherits(options.RemoteVideoTrack, EventEmitter);

  options.log = log;
  options.signaling = options.signaling || makeSignaling(options);
  options.participant = options.participant || new Participant(options.signaling, options);

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
  track.mediaStreamTrack = { id: track.id };
  track.mediaStream = {};
  track.getMediaStreamTrackDeferred = util.defer();
  track.getMediaStreamTrackDeferred.resolve(track.mediaStreamTrack);
  track.getMediaStreamTrack = sinon.spy(() => track.getMediaStreamTrackDeferred.promise);
  return track;
}
