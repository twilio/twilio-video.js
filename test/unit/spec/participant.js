'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Participant = require('../../../lib/participant');
var sinon = require('sinon');
var util = require('../../../lib/util');
var log = require('../../lib/fakelog');

describe('Participant', function() {
  describe('constructor', () => {
    context('when Media is provided', () => {
      it('sets .identity to the ParticipantSignaling\'s .identity', () => {
        var media = makeMedia();
        var test = makeTest({ media: media });
        assert.equal(test.identity, test.participant.identity);
      });

      it('sets .sid to the ParticipantSignaling\'s .sid', () => {
        var media = makeMedia();
        var test = makeTest({ media: media });
        assert.equal(test.sid, test.participant.sid);
      });

      it('sets .state to the ParticipantSignaling\'s .state', () => {
        var media = makeMedia();
        var test = makeTest({ media: media });
        assert.equal(test.state, test.participant.state);
      });

      it('sets .media to the provided Media', () => {
        var media = makeMedia();
        var test = makeTest({ media: media });
        assert.equal(media, test.participant.media);
      });
    });

    context('when Media is not provided', () => {
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

      it('sets .media to a new Media instance', () => {
        var test = makeTest();
        assert(test.media, test.participant.media);
      });
    });
  });

  describe('.media', () => {
    context('when the Participant begins in .state "connected"', () => {
      it('re-emits "trackAdded" events', () => {
        var track = {};
        var trackAdded;
        var test = makeTest();
        test.participant.once('trackAdded', track => trackAdded = track);
        test.participant.media.emit('trackAdded', track);
        assert.equal(track, trackAdded);
      });

      it('re-emits "trackDimensionsChanged" events', () => {
        var track = {};
        var trackDimensionsChanged;
        var test = makeTest();
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        test.participant.media.emit('trackDimensionsChanged', track);
        assert.equal(track, trackDimensionsChanged);
      });

      it('re-emits "trackDisabled" events', () => {
        var track = {};
        var trackDisabled;
        var test = makeTest();
        test.participant.once('trackDisabled', track => trackDisabled = track);
        test.participant.media.emit('trackDisabled', track);
        assert.equal(track, trackDisabled);
      });

      it('re-emits "trackEnabled" events', () => {
        var track = {};
        var trackEnabled;
        var test = makeTest();
        test.participant.once('trackEnabled', track => trackEnabled = track);
        test.participant.media.emit('trackEnabled', track);
        assert.equal(track, trackEnabled);
      });

      it('re-emits "trackRemoved" events', () => {
        var track = {};
        var trackRemoved;
        var test = makeTest();
        test.participant.once('trackRemoved', track => trackRemoved = track);
        test.participant.media.emit('trackRemoved', track);
        assert.equal(track, trackRemoved);
      });

      it('re-emits "trackStarted" events', () => {
        var track = {};
        var trackStarted;
        var test = makeTest();
        test.participant.once('trackStarted', track => trackStarted = track);
        test.participant.media.emit('trackStarted', track);
        assert.equal(track, trackStarted);
      });
    });

    context('when the Participant .state transitions to "disconnected"', () => {
      it('does not re-emit "trackAdded" events', () => {
        var track = {};
        var trackAdded;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackAdded', track => trackAdded = track);
        test.participant.media.emit('trackAdded', track);
        assert(!trackAdded);
      });

      it('does not re-emit "trackDimensionsChanged" events', () => {
        var track = {};
        var trackDimensionsChanged;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        test.participant.media.emit('trackDimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "trackDisabled" events', () => {
        var track = {};
        var trackDisabled;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackDisabled', track => trackDisabled = track);
        test.participant.media.emit('trackDisabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "trackEnabled" events', () => {
        var track = {};
        var trackEnabled;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackEnabled', track => trackEnabled = track);
        test.participant.media.emit('trackEnabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "trackRemoved" events', () => {
        var track = {};
        var trackRemoved;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackRemoved', track => trackRemoved = track);
        test.participant.media.emit('trackRemoved', track);
        assert(!trackRemoved);
      });

      it('does not re-emit "trackStarted" events', () => {
        var track = {};
        var trackStarted;
        var test = makeTest();
        test.signaling.emit('stateChanged', 'disconnected');
        test.participant.once('trackStarted', track => trackStarted = track);
        test.participant.media.emit('trackStarted', track);
        assert(!trackStarted);
      });
    });

    context('when the Participant .state begins in "disconnected"', () => {
      it('does not re-emit "trackAdded" events', () => {
        var track = {};
        var trackAdded;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackAdded', track => trackAdded = track);
        test.participant.media.emit('trackAdded', track);
        assert(!trackAdded);
      });

      it('does not re-emit "trackDimensionsChanged" events', () => {
        var track = {};
        var trackDimensionsChanged;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackDimensionsChanged', track => trackDimensionsChanged = track);
        test.participant.media.emit('trackDimensionsChanged', track);
        assert(!trackDimensionsChanged);
      });

      it('does not re-emit "trackDisabled" events', () => {
        var track = {};
        var trackDisabled;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackDisabled', track => trackDisabled = track);
        test.participant.media.emit('trackDisabled', track);
        assert(!trackDisabled);
      });

      it('does not re-emit "trackEnabled" events', () => {
        var track = {};
        var trackEnabled;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackEnabled', track => trackEnabled = track);
        test.participant.media.emit('trackEnabled', track);
        assert(!trackEnabled);
      });

      it('does not re-emit "trackRemoved" events', () => {
        var track = {};
        var trackRemoved;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackRemoved', track => trackRemoved = track);
        test.participant.media.emit('trackRemoved', track);
        assert(!trackRemoved);
      });

      it('does not re-emit "trackStarted" events', () => {
        var track = {};
        var trackStarted;
        var test = makeTest({ state: 'disconnected' });
        test.participant.once('trackStarted', track => trackStarted = track);
        test.participant.media.emit('trackStarted', track);
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
          it('constructs a new AudioTrack or VideoTrack, depending on the TrackSignaling\'s .kind', () => {
            var test = makeTest();
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(audioTrack.mediaStream, test.AudioTrack.args[0][0]);
              assert.equal(audioTrack.mediaStreamTrack, test.AudioTrack.args[0][1]);
              assert.equal(audioTrack, test.AudioTrack.args[0][2]);

              assert.equal(videoTrack.mediaStream, test.VideoTrack.args[0][0]);
              assert.equal(videoTrack.mediaStreamTrack, test.VideoTrack.args[0][1]);
              assert.equal(videoTrack, test.VideoTrack.args[0][2]);
            });
          });

          it('calls ._addTrack on the Participant\'s Media with the newly-constructed Track', () => {
            var test = makeTest({ media: makeMedia() });
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert.equal(test.tracks[0], test.media._addTrack.args[0][0]);
              assert.equal(test.tracks[1], test.media._addTrack.args[1][0]);
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
          assert(!test.AudioTrack.calledOnce);
          assert(!test.VideoTrack.calledOnce);
        });

        it('does not call ._addTrack on the Participant\'s Media', () => {
          var test = makeTest({ media: makeMedia() });
          test.signaling.emit('stateChanged', 'disconnected');
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.media._addTrack.calledOnce);
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
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.AudioTrack.calledOnce);
          assert(!test.VideoTrack.calledOnce);
        });

        it('does not call ._addTrack on the Participant\'s Media', () => {
          var test = makeTest({ media: makeMedia(), state: 'disconnected' });
          var audioTrack = makeTrackSignaling({ kind: 'audio' });
          var videoTrack = makeTrackSignaling({ kind: 'video' });
          test.signaling.emit('trackAdded', audioTrack);
          test.signaling.emit('trackAdded', videoTrack);
          assert(!test.media._addTrack.calledOnce);
        });
      });
    });

    context('"trackRemoved" event', () => {
      context('when the Participant .state begins in "connected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling exists in the Participant\'s Media\'s .tracks Map', () => {
          it('calls ._removeTrack on the Participant\'s Media with the Track', () => {
            var test = makeTest({ media: makeMedia() });
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackAdded', audioTrack);
            test.signaling.emit('trackAdded', videoTrack);
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(test.tracks[0], test.media._removeTrack.args[0][0]);
              assert(test.tracks[1], test.media._removeTrack.args[1][0]);
            });
          });
        });

        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Media\'s .tracks Map', () => {
          it('does not call ._removeTrack on the Participant\'s Media', () => {
            var test = makeTest({ media: makeMedia() });
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.media._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the Participant .state transitions to "disconnected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling exists in the Participant\'s Media\'s .tracks Map', () => {
          it('does not call ._removeTrack on the Participant\'s Media', () => {
            var test = makeTest({ media: makeMedia() });
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
              assert(!test.media._removeTrack.calledOnce);
            });
          });
        });

        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Media\'s .tracks Map', () => {
          it('does not call ._removeTrack on the Participant\'s Media', () => {
            var test = makeTest({ media: makeMedia() });
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('stateChanged', 'disconnected');
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.media._removeTrack.calledOnce);
            });
          });
        });
      });

      context('when the Participant .state begins in "disconnected"', () => {
        context('and a Track with an .id matching that of the TrackSignaling does not exist in the Participant\'s Media\'s .tracks Map', () => {
          it('does not call ._removeTrack on the Participant\'s Media', () => {
            var test = makeTest({ media: makeMedia(), state: 'disconnected' });
            var audioTrack = makeTrackSignaling({ kind: 'audio' });
            var videoTrack = makeTrackSignaling({ kind: 'video' });
            test.signaling.emit('trackRemoved', audioTrack);
            test.signaling.emit('trackRemoved', videoTrack);
            return Promise.all([
              audioTrack.getMediaStreamTrackDeferred.promise,
              videoTrack.getMediaStreamTrackDeferred.promise
            ]).then(() => {
              assert(!test.media._removeTrack.calledOnce);
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
          it('constructs a new AudioTrack or VideoTrack, depending on the TrackSignaling\'s .kind', () => {
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
              assert.equal(audioTrack.mediaStream, test.AudioTrack.args[0][0]);
              assert.equal(audioTrack.mediaStreamTrack, test.AudioTrack.args[0][1]);
              assert.equal(audioTrack, test.AudioTrack.args[0][2]);

              assert.equal(videoTrack.mediaStream, test.VideoTrack.args[0][0]);
              assert.equal(videoTrack.mediaStreamTrack, test.VideoTrack.args[0][1]);
              assert.equal(videoTrack, test.VideoTrack.args[0][2]);
            });
          });

          it('calls ._addTrack on the Participant\'s Media with the newly-constructed Track', () => {
            var test = makeTest({
              media: makeMedia(),
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
              assert.equal(test.tracks[0], test.media._addTrack.args[0][0]);
              assert.equal(test.tracks[1], test.media._addTrack.args[1][0]);
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
            media: makeMedia(),
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

        it('does not call ._addTrack on the Participant\'s Media', () => {
          var test = makeTest({
            media: makeMedia(),
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
            assert(!test.media._addTrack.calledOnce);
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
  
  if (typeof options.trackSignalings === 'number') {
    var trackSignalings = [];
    for (var i = 0; i < options.trackSignalings; i++) {
      tracks.push(makeTrackSignaling());
    }
    options.trackSignalings = trackSignalings;
  }
  options.trackSignalings = options.trackSignalings ? options.trackSignalings.map(makeTrackSignaling) : [];

  options.tracks = options.tracks || [];
  options.AudioTrack = sinon.spy(function AudioTrack(mediaStream, mediaStreamTrack, signaling) {
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.mediaStream = mediaStream;
    this.mediaStreamTrack = mediaStreamTrack;
    this.signaling = signaling;
    options.tracks.push(this);
  });
  options.VideoTrack = sinon.spy(function VideoTrack(mediaStream, mediaStreamTrack, signaling) {
    this.id = signaling.id;
    this.kind = signaling.kind;
    this.mediaStream = mediaStream;
    this.mediaStreamTrack = mediaStreamTrack;
    this.signaling = signaling;
    options.tracks.push(this);
  });

  options.log = log;
  options.signaling = options.signaling || makeSignaling(options);
  options.participant = options.participant || new Participant(options.signaling, options.media, options);
  options.media = options.media || options.participant.media;

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

function makeMedia() {
  var media = new EventEmitter();
  media.tracks = new Map();
  media._addTrack = sinon.spy(track => {
    media.tracks.set(track.id, track);
  });
  media._removeTrack = sinon.spy(track => {
    media.tracks.delete(track.id);
  });
  return media;
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
  track.getMediaStreamTrackDeferred.resolve([
    track.mediaStreamTrack,
    track.mediaStream
  ]);
  track.getMediaStreamTrack = sinon.spy(() => track.getMediaStreamTrackDeferred.promise);
  return track;
}
