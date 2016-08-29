'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var RoomV2 = require('../../../../../lib/signaling/v2/room');
var sinon = require('sinon');

describe('RoomV2', () => {
  // RoomV2
  // ------

  describe('constructor', () => {
    it('sets .localParticipant', () => {
      var test = makeTest();
      assert.equal(
        test.localParticipant,
        test.room.localParticipant);
    });

    it('sets .name', () => {
      var test = makeTest();
      assert.equal(
        test.name,
        test.room.name);
    });

    it('sets .sid', () => {
      var test = makeTest();
      assert.equal(
        test.sid,
        test.room.sid);
    });

    it('sets the .state to "connected"', () => {
      var test = makeTest();
      assert.equal(
        'connected',
        test.room.state);
    });

    context('.participants', () => {
      it('constructs a new ParticipantV2 for each Participant state', () => {
        var sid1 = makeParticipantSid();
        var sid2 = makeParticipantSid();
        var test = makeTest({
          participants: [
            { sid: sid1 },
            { sid: sid2 }
          ]
        });
        assert.equal(sid1, test.participantV2s[0].sid);
        assert.equal(sid2, test.participantV2s[1].sid);
      });

      it('adds the newly-constructed ParticipantV2s to the RoomV2\'s .participants Map', () => {
        var sid1 = makeParticipantSid();
        var sid2 = makeParticipantSid();
        var test = makeTest({
          participants: [
            { sid: sid1 },
            { sid: sid2 }
          ]
        });
        assert.equal(
          test.participantV2s[0],
          test.room.participants.get(sid1));
        assert.equal(
          test.participantV2s[1],
          test.room.participants.get(sid2));
      });

      it('calls .update with the Participants states on the newly-constructed RemoteParticipantV2s', () => {
        var sid1 = makeParticipantSid();
        var sid2 = makeParticipantSid();
        var test = makeTest({
          participants: [
            { sid: sid1, foo: 'bar' },
            { sid: sid2, baz: 'qux' }
          ]
        });
        assert.deepEqual(
          { sid: sid1, foo: 'bar' },
          test.participantV2s[0].update.args[0][0]);
        assert.deepEqual(
          { sid: sid2, baz: 'qux' },
          test.participantV2s[1].update.args[0][0]);
      });
    });

    context('.peer_connections', () => {
      it('calls .update with the .peer_connections on the PeerConnectionManager', () => {
        var test = makeTest({
          peer_connections: { fizz: 'buzz' }
        });
        assert.deepEqual(
          { fizz: 'buzz' },
          test.peerConnectionManager.update.args[0][0]);
      });
    });

    context('PeerConnectionManager', () => {
      it('dequeues any enqueued "candidates" events', () => {
        var test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('candidates'));
      });

      it('dequeues any enqueued "description" events', () => {
        var test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('description'));
      });

      it('dequeues any enqueued "trackAdded" events', () => {
        var test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('trackAdded'));
      });

      context('before the getMediaStreamTrack function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
        it('calling getMediaStreamTrack resolves to the MediaStreamTrack and MediaStream', () => {
          var id = makeId();
          var mediaStreamTrack = { id: id };
          var mediaStream = {};
          mediaStream.getTracks = () => [mediaStreamTrack];
          var peerConnectionManager = makePeerConnectionManager();
          peerConnectionManager.getRemoteMediaStreams = () => [mediaStream];

          var test = makeTest({
            participants: [
              { sid: makeSid() }
            ],
            peerConnectionManager: peerConnectionManager
          });

          return test.participantV2s[0].getMediaStreamTrack(id).then(pair => {
            assert.equal(
              mediaStreamTrack,
              pair[0]);
            assert.equal(
              mediaStream,
              pair[1]);
          });
        });
      });
    });
  });

  // RoomSignaling
  // -------------

  describe('#connectParticipant, called when the ParticipantV2 was', () => {
    context('previously connected', () => {
      it('returns false', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() }
          ]
        });
        assert.equal(
          false,
          test.room.connectParticipant(test.participantV2s[0]));
      });

      it('the ParticipantV2 remains in the RoomV2\'s .participants Map', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() }
          ]
        });
        test.room.connectParticipant(test.participantV2s[0]);
        assert.equal(
          test.participantV2s[0],
          test.room.participants.get(test.participantV2s[0].sid));
      });

      it('does not emit the "participantConnected" event', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() }
          ]
        });
        var participantConnected = false;
        test.room.once('participantConnected', () => participantConnected = true);
        test.room.connectParticipant(test.participantV2s[0]);
        assert(!participantConnected);
      });
    });

    context('not previously connected', () => {
      it('returns true', () => {
        var RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        var participant = new RemoteParticipantV2({ sid: makeSid() });
        var test = makeTest();
        assert.equal(
          true,
          test.room.connectParticipant(participant));
      });

      it('adds the ParticipantV2 to the RoomV2\'s .participants Map', () => {
        var RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        var participant = new RemoteParticipantV2({ sid: makeSid() });
        var test = makeTest();
        test.room.connectParticipant(participant);
        assert.equal(
          participant,
          test.room.participants.get(participant.sid));
      });

      it('emits the "participantConnected" event with the ParticipantV2', () => {
        var RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        var participant = new RemoteParticipantV2({ sid: makeSid() });
        var test = makeTest();
        var participantConnected;
        test.room.once('participantConnected', participant => participantConnected = participant);
        test.room.connectParticipant(participant);
        assert.equal(
          participant,
          participantConnected);
      });
    });
  });

  describe('#disconnect, called when the RoomV2 .state is', () => {
    context('"connected"', () => {
      it('returns true', () => {
        var test = makeTest();
        assert.equal(
          true,
          test.room.disconnect());
      });

      it('sets the .state to "disconnected"', () => {
        var test = makeTest();
        test.room.disconnect();
        assert.equal(
          'disconnected',
          test.room.state);
      });

      it('emits the "stateChanged" event with the new state "disconnected"', () => {
        var test = makeTest();
        var newState;
        test.room.once('stateChanged', state => newState = state);
        test.room.disconnect();
        assert.equal(
          'disconnected',
          newState);
      });

      it('calls .disconnect on the Transport', () => {
        var test = makeTest();
        test.room.disconnect();
        assert(test.transport.disconnect.calledOnce);
      });

      it('does not call .disconnect on any connected ParticipantV2\'s', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV2\'s from the RoomV2\'s .participants Map', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert.equal(
            participant,
            test.room.participants.get(participant.sid));
        });
      });

      it('does not emit any "participantDisconnected" events', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        var participantDisconnected = false;
        test.room.once('participantDisconnected', () => participantDisconnected = true);
        test.room.disconnect();
        assert(!participantDisconnected);
      });
    });

    context('"disconnected"', () => {
      it('returns false', () => {
        var test = makeTest();
        test.room.disconnect();
        assert.equal(
          false,
          test.room.disconnect());
      });

      it('the .state remains "disconnected"', () => {
        var test = makeTest();
        test.room.disconnect();
        test.room.disconnect();
        assert.equal(
          'disconnected',
          test.room.state);
      });

      it('does not emit the "stateChanged" event', () => {
        var test = makeTest();
        test.room.disconnect();
        var stateChanged = false;
        test.room.once('stateChanged', () => stateChanged = true);
        test.room.disconnect();
        assert(!stateChanged);
      });

      it('does not call .disconnect on the Transport', () => {
        var test = makeTest();
        test.room.disconnect();
        test.room.disconnect();
        assert(!test.transport.disconnect.calledTwice);
      });

      it('does not call .disconnect on any connected ParticipantV2\'s', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        test.room.disconnect();
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV2\'s from the RoomV2\'s .participants Map', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        test.room.disconnect();
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert.equal(
            participant,
            test.room.participants.get(participant.sid));
        });
      });

      it('does not emit any "participantDisconnected" events', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() },
            { sid: makeSid() }
          ]
        });
        test.room.disconnect();
        var participantDisconnected = false;
        test.room.once('participantDisconnected', () => participantDisconnected = true);
        test.room.disconnect();
        assert(!participantDisconnected);
      });
    });
  });

  describe('"participantDisconnected" event', () => {
    context('when a connected ParticipantV2 emits a "stateChanged" event with a new state "disconnected"', () => {
      it('removes the ParticipantV2 from the RoomV2\'s .participants Map', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() }
          ]
        });
        test.participantV2s[0].emit('stateChanged', 'disconnected');
        assert(!test.room.participants.has(test.participantV2s[0].sid));
      });

      it('emits the "participantDisconnected" event with the ParticipantV2', () => {
        var test = makeTest({
          participants: [
            { sid: makeSid() }
          ]
        });
        var participantDisconnected;
        test.room.once('participantDisconnected', participant => participantDisconnected = participant);
        test.participantV2s[0].emit('stateChanged', 'disconnected');
        assert.equal(
          test.participantV2s[0],
          participantDisconnected);
      });
    });
  });

  describe('LocalParticipantSignaling', () => {
    context('"trackAdded" event', () => {
      it('calls .setMediaStreams with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaStreams on the PeerConnectionManager', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        assert.equal(
          track.mediaStream,
          Array.from(test.peerConnectionManager.setMediaStreams.args[0][0].values())[0]);
      });

      it('calls .update on the LocalParticipantSignaling', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        assert(test.localParticipant.update.calledOnce);
      });

      it('calls .publish on the Transport with the LocalparticipantSignaling state', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        assert.deepEqual(
          {
            participant: {
              revision: 1
            }
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('"trackRemoved" event', () => {
      it('calls .setMediaStreams with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaStreams on the PeerConnectionManager', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        assert.equal(
          track.mediaStream,
          Array.from(test.peerConnectionManager.setMediaStreams.args[0][0].values())[0]);
      });

      it('calls .update on the LocalParticipantSignaling', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        assert(test.localParticipant.update.calledOnce);
      });

      it('calls .publish on the Transport with the LocalParticipantSignaling state', () => {
        var track = makeTrack();
        var test = makeTest({
          tracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        assert.deepEqual(
          {
            participant: {
              revision: 1
            }
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('when an added TrackV2 emits a "stateChanged" event in a new state', () => {
      context('"disabled"', () => {
        it('calls .publish on the Transport with the LocalParticipantSignaling state', () => {
          var track = makeTrack();
          var test = makeTest({
            tracks: [track]
          });
          track.emit('stateChanged', 'disabled');
          assert.deepEqual(
            {
              participant: {
                revision: 1
              }
            },
            test.transport.publish.args[0][0]);
        });
      });

      context('"enabled"', () => {
        it('calls .publish on the Transport with the LocalParticipantSignaling state', () => {
          var track = makeTrack();
          var test = makeTest({
            tracks: [track]
          });
          track.emit('stateChanged', 'enabled');
          assert.deepEqual(
            {
              participant: {
                revision: 1
              }
            },
            test.transport.publish.args[0][0]);
        });
      });
    });

    context('when a removed TrackV2 emits a "stateChanged" event in a new state', () => {
      context('"disabled"', () => {
        it('does not call .publish on the Transport', () => {
          var track = makeTrack();
          var test = makeTest({
            tracks: [track]
          });
          test.localParticipant.emit('trackRemoved', track);
          track.emit('stateChanged', 'disabled');
          assert(!test.transport.publish.calledTwice);
        });
      });

      context('"enabled"', () => {
        it('does not call .publish on the Transport', () => {
          var track = makeTrack();
          var test = makeTest({
            tracks: [track]
          });
          test.localParticipant.emit('trackRemoved', track);
          track.emit('stateChanged', 'enabled');
          assert(!test.transport.publish.calledTwice);
        });
      });
    });
  });

  describe('PeerConnectionManager', () => {
    context('when the PeerConnectionManager emits a "description" event', () => {
      it('calls .publish on the Transport with the PeerConnectionManager\'s new description', () => {
        var test = makeTest();
        test.peerConnectionManager.emit('description', { fizz: 'buzz' });
        assert.deepEqual(
          {
            participant: {
              revision: 0
            },
            peer_connections: [
              { fizz: 'buzz' }
            ]
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('when the PeerConnectionManager emits a "candidates" event', () => {
      it('calls .publish on the Transport with the PeerConnectionManager\'s new candidates', () => {
        var test = makeTest();
        test.peerConnectionManager.emit('candidates', { fizz: 'buzz' });
        assert.deepEqual(
          {
            participant: {
              revision: 0
            },
            peer_connections: [
              { fizz: 'buzz' }
            ]
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('when the PeerConnectionManager emits a "trackAdded" event', () => {
      context('before the getMediaStreamTrack function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
        it('calling getMediaStreamTrack resolves to the MediaStreamTrack and MediaStream', () => {
          var test = makeTest({
            participants: [
              { sid: makeSid() }
            ]
          });
          var id = makeId();
          var mediaStreamTrack = { id: id };
          var mediaStream = {};
          test.peerConnectionManager.emit('trackAdded', mediaStreamTrack, mediaStream);
          return test.participantV2s[0].getMediaStreamTrack(id).then(pair => {
            assert.equal(
              mediaStreamTrack,
              pair[0]);
            assert.equal(
              mediaStream,
              pair[1]);
          });
        });
      });

      context('after the getMediaStreamTrack function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
        it('calling getMediaStreamTrack resolves to the MediaStreamTrack and MediaStream', () => {
          var test = makeTest({
            participants: [
              { sid: makeSid() }
            ]
          });
          var id = makeId();
          var mediaStreamTrack = { id: id };
          var mediaStream = {};
          var promise = test.participantV2s[0].getMediaStreamTrack(id);
          test.peerConnectionManager.emit('trackAdded', mediaStreamTrack, mediaStream);
          return promise.then(pair => {
            assert.equal(
              mediaStreamTrack,
              pair[0]);
            assert.equal(
              mediaStream,
              pair[1]);
          });
        });
      });
    });
  });

  describe('when the Transport emits an "message" event containing Room state', () => {
    context('when the .name changes', () => {
      it('the .name remains the same', () => {
        var test = makeTest();
        test.transport.emit('message', {
          name: makeName(),
          participants: [],
          peer_connections: []
        });
        assert.equal(
          test.name,
          test.room.name);
      });
    });

    context('when the .sid changes', () => {
      it('the .sid remains the same', () => {
        var test = makeTest();
        test.transport.emit('message', {
          participants: [],
          peer_connections: [],
          sid: makeSid()
        });
        assert.equal(
          test.sid,
          test.room.sid);
      });
    });

    context('.participants', () => {
      context('when .participants includes a new Participant state', () => {
        context('and the Participant state\'s .state is "connected"', () => {
          it('constructs a new ParticipantV2 with the Participant state', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid }
              ],
              peer_connections: []
            });
            assert.equal(
              sid,
              test.participantV2s[0].sid);
          });

          it('adds the newly-constructed ParticipantV2 to the RoomV2\'s .participants Map', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid }
              ],
              peer_connections: []
            });
            assert.equal(
              test.participantV2s[0],
              test.room.participants.get(sid));
          });

          it('emits the "participantConnected" event with the newly-constructed ParticipantV2', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            var participantConnected;
            test.room.once('participantConnected', participant => participantConnected = participant);
            test.transport.emit('message', {
              participants: [
                { sid: sid }
              ],
              peer_connections: []
            });
            assert.equal(
              test.participantV2s[0],
              participantConnected);
          });

          it('calls .update with the Participant state on the newly-constructed ParticipantV2', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, fizz: 'buzz' }
              ],
              peer_connections: []
            });
            assert.deepEqual(
              { sid: sid, fizz: 'buzz' },
              test.participantV2s[0].update.args[0][0]);
          });
        });

        context('and the Participant state\'s .state is "disconnected"', () => {
          it('constructs a new ParticipantV2 with the Participant state', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected' }
              ],
              peer_connections: []
            });
            assert.equal(
              sid,
              test.participantV2s[0].sid);
          });

          it('does not add the newly-constructed ParticipantV2 to the RoomV2\'s .participants Map', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected' }
              ],
              peer_connections: []
            });
            assert(!test.room.participants.has(sid));
          });

          it('does not emit a "participantConnected" event', () => {
            var test = makeTest();
            var sid = makeParticipantSid();
            var participantConnected;
            test.room.once('participantConnected', () => participantConnected = true);
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected' }
              ],
              peer_connections: []
            });
            assert(!participantConnected);
          });
        });
      });

      context('when .participants includes a Participant state for a connected ParticipantV2', () => {
        it('calls .update with the Participant state on the ParticipantV2', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz' }
            ],
            peer_connections: []
          });
          assert.deepEqual(
            { sid: sid, fizz: 'buzz' },
            test.participantV2s[0].update.args[1][0]);
        });
      });

      context('when .participants includes a Participant state for a disconnected ParticipantV2', () => {
        it('does not construct a new ParticipantV2 with the Participant state', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          test.participantV2s[0].emit('stateChanged', 'disconnected');
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz' }
            ],
            peer_connections: []
          });
          assert.equal(
            1,
            test.participantV2s.length);
        });

        it('does not call .update with the Participant state on the disconnected ParticipantV2', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          test.participantV2s[0].emit('stateChanged', 'disconnected');
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz' }
            ],
            peer_connections: []
          });
          assert(!test.participantV2s[0].update.calledTwice);
        });
      });

      context('when .participants omits a Participant state for a connected ParticipantV2', () => {
        it('does not call .disconnect on the ParticipantV2', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          test.transport.emit('message', {
            participants: [],
            peer_connections: []
          });
          assert(!test.participantV2s[0].disconnect.calledOnce);
        });

        it('the ParticipantV2 remains in the RoomV2\'s .participants Map', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          test.transport.emit('message', {
            participants: [],
            peer_connections: []
          });
          assert.equal(
            test.participantV2s[0],
            test.room.participants.get(sid));
        });

        it('does not emit a "participantDisconnected" event', () => {
          var sid = makeParticipantSid();
          var test = makeTest({
            participants: [
              { sid: sid }
            ]
          });
          var participantDisconnected = false;
          test.room.once('participantDisconnected', () => participantDisconnected = true);
          test.transport.emit('message', {
            participants: [],
            peer_connections: []
          });
          assert(!participantDisconnected);
        });
      });
    });

    context('.peer_connections', () => {
      it('calls .update with the .peer_connections on the PeerConnectionManager', () => {
        var test = makeTest();
        test.transport.emit('message', {
          participants: [],
          peer_connections: { fizz: 'buzz' }
        });
        assert.deepEqual(
          { fizz: 'buzz' },
          test.peerConnectionManager.update.args[0][0]);
      });
    });
  });
});

function makeId() {
  return Math.floor(Math.random() * 1000 + 0.5);
}

function makeIdentity() {
  return Math.random().toString(36).slice(2);
}

function makeName() {
  return Math.random().toString(36).slice(2);
}

function makeSid() {
  var sid = 'RM';
  for (var i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeParticipantSid() {
  var sid = 'PA';
  for (var i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeRevision() {
  return Math.floor(Math.random() * 101);
}

function makeTest(options) {
  options = options || {};

  options.name = options.name || makeName();
  options.sid = options.sid || makeSid();
  options.participants = options.participants || [];
  options.participantV2s = options.participantV2s || [];

  options.RemoteParticipantV2 = options.RemoteParticipantV2 || makeRemoteParticipantV2Constructor(options);
  options.tracks = options.tracks || [];
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(options);
  options.transport = options.transport || makeTransport(options);

  options.room = options.room || makeRoomV2(options);

  options.state = function state() {
    return new RoomStateBuilder(room);
  };

  return options;
}

function makeRemoteParticipantV2Constructor(testOptions) {
  testOptions = testOptions || {};
  testOptions.participantV2s = [];

  function RemoteParticipantV2(initialState, getMediaStreamTrack) {
    EventEmitter.call(this);
    this.state = initialState.state || 'connected';
    this.sid = initialState.sid;
    this.getMediaStreamTrack = getMediaStreamTrack;
    this.disconnect = sinon.spy(() => {
      this.state = 'disconnected';
      this.emit('stateChanged', this.state);
    });
    this.update = sinon.spy(() => {});
    testOptions.participantV2s.push(this);
  }

  inherits(RemoteParticipantV2, EventEmitter);

  return RemoteParticipantV2;
}

function makeRoomV2(options) {
  return new RoomV2(options.localParticipant, options, options.transport, options.peerConnectionManager, options);
}

function makeTransport(options) {
  var transport = new EventEmitter();
  transport.disconnect = sinon.spy(() => {});
  transport.publish = sinon.spy(() => {});
  transport.sync = sinon.spy(() => {});
  return transport;
};

function makePeerConnectionManager(options) {
  var peerConnectionManager = new EventEmitter();
  peerConnectionManager.dequeue = sinon.spy(() => {});
  peerConnectionManager.setMediaStreams = sinon.spy(() => {});
  peerConnectionManager.getRemoteMediaStreams = sinon.spy(() => []);
  peerConnectionManager.update = sinon.spy(() => {});
  return peerConnectionManager;
}

function RoomStateBuilder(room) {
  this.name = room.name;
  this.sid = room.sid;
  this.participants = [];
  this.peer_connections = [];
}

RoomStateBuilder.prototype.setName = function setName(name) {
  this.name = name;
  return this;
};

RoomStateBuilder.prototype.setSid = function setSid(sid) {
  this.sid = sid;
  return this;
};

RoomStateBuilder.prototype.setPeerConnection = function setPeerConnection(peerConnection) {
  this.peer_connections.push(peerConnection);
  return this;
};

RoomStateBuilder.prototype.setPeerConnections = function setPeerConnections(peerConnections) {
  peerConnections.forEach(this.setPeerConnection, this);
  return this;
};

RoomStateBuilder.prototype.setParticipant = function setParticipant(participant) {
  this.participants.push(participant);
  return this;
};

RoomStateBuilder.prototype.setParticipants = function setParticipants(participants) {
  participants.forEach(this.setParticipant, this);
  return this;
};

function makeLocalParticipant(options) {
  var localParticipant = new EventEmitter();
  localParticipant.sid = makeSid();
  localParticipant.identity = makeIdentity();
  localParticipant.revision = 0;
  localParticipant.getState = sinon.spy(() => ({ revision: localParticipant.revision }));
  localParticipant.update = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.tracks;
  localParticipant.disconnect = sinon.spy(() => {});
  return localParticipant;
}

function makeTrack(options) {
  var track = new EventEmitter();
  options = options || {};
  track.id = options.id || makeId();
  track.mediaStream = {};
  return track;
}
