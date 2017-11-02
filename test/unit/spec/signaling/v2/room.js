'use strict';

const assert = require('assert');
const { EventEmitter }  = require('events');
const { inherits } = require('util');
const sinon = require('sinon');

const { flatMap } = require('../../../../../lib/util');

const RoomV2 = require('../../../../../lib/signaling/v2/room');

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

    describe('.localParticipant', () => {
      it('should call .update on the LocalParticipant with the `published` payload before calling `connect`', () => {
        const localParticipant = makeLocalParticipant({ localTracks: [] });
        const methods = [];
        const participant = { sid: 'foo', identity: 'bar' };
        const published = { revision: 1, tracks: [] };
        localParticipant.update = sinon.spy(() => methods.push('update'));
        localParticipant.connect = sinon.spy(() => methods.push('connect'));
        makeTest({
          localParticipant,
          participant,
          published
        });
        assert.deepEqual(methods, ['update', 'connect']);
        sinon.assert.calledWith(localParticipant.update, published);
        sinon.assert.calledWith(localParticipant.connect, 'foo', 'bar');
      });
    });

    it('should periodically call .publishEvent on the underlying Transport', async () => {
      const test = makeTest({
        localTracks: [
          { id: '1', kind: 'audio' },
          { id: '2', kind: 'video' },
        ],
        statsPublishIntervalMs: 50
      });
      test.room._update({
        published: {
          revision: 1,
          tracks: [
            { id: '1', sid: 'MT1' },
            { id: '2', sid: 'MT2' }
          ]
        }
      });
      function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      const expectedArgs = [
        [
          'quality',
          'stats-report',
          {
            audioTrackStats: [],
            localAudioTrackStats: [{ trackId: '1' }],
            localVideoTrackStats: [{ trackId: '2' }],
            participantSid: test.localParticipant.sid,
            peerConnectionId: 'foo',
            roomSid: test.sid,
            videoTrackStats: []
          }
        ],
        [
          'quality',
          'stats-report',
          {
            audioTrackStats: [],
            localAudioTrackStats: [{ trackId: '1' }],
            localVideoTrackStats: [{ trackId: '2' }],
            participantSid: test.localParticipant.sid,
            peerConnectionId: 'bar',
            roomSid: test.sid,
            videoTrackStats: []
          }
        ]
      ];
      await wait(175);
      assert.deepEqual(test.transport.publishEvent.args.slice(0, 2), expectedArgs);
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

      context('before the getMediaStreamTrackOrDataTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
        it('calling getMediaStreamTrackOrDataTrackTransceiver resolves to the MediaStreamTrack and MediaStream', () => {
          const id = makeId();
          const mediaStreamTrack = { id: id };
          const peerConnectionManager = makePeerConnectionManager([], []);
          peerConnectionManager.getRemoteMediaStreamTracksAndDataTrackReceivers = () => [mediaStreamTrack];

          var test = makeTest({
            participants: [
              { sid: makeSid() }
            ],
            peerConnectionManager: peerConnectionManager
          });

          return test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id).then(track => {
            assert.equal(mediaStreamTrack, track);
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

  describe('#getStats', () => {
    it('only returns results for published Local- or Remote-Tracks', async () => {
      const test = makeTest({
        localTracks: [
          { id: '1', kind: 'audio' },
          { id: '2', kind: 'video' }
        ]
      });
      test.room._update({
        published: {
          revision: 1,
          tracks: [
            { id: '1', sid: 'MT1' },
            { id: '2', sid: 'MT2' }
          ]
        },
        subscribed: {
          revision: 1,
          tracks: [
            { id: '3', sid: 'MT3' },
            { id: '4', sid: 'MT4' }
          ]
        },
        participants: [
          {
            identity: 'alice',
            sid: 'PA1',
            state: 'connected',
            tracks: [
              { id: '3', kind: 'audio', sid: 'MT3' }
            ]
          },
          {
            identity: 'bob',
            sid: 'PA2',
            state: 'connected',
            tracks: [
              { id: '4', kind: 'video', sid: 'MT4' }
            ]
          }
        ]
      });

      const reports = await test.room.getStats();
      const localAudioTrackStats = [
        { trackId: '1' }
      ];
      const localVideoTrackStats = [
        { trackId: '2' }
      ];
      const remoteAudioTrackStats = [
        { trackId: '3' }
      ];
      const remoteVideoTrackStats = [
        { trackId: '4' }
      ];
      assert.deepEqual(reports, [
        {
          localAudioTrackStats,
          localVideoTrackStats,
          peerConnectionId: 'foo',
          remoteAudioTrackStats,
          remoteVideoTrackStats
        },
        {
          localAudioTrackStats,
          localVideoTrackStats,
          peerConnectionId: 'bar',
          remoteAudioTrackStats,
          remoteVideoTrackStats
        }
      ]);
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

      it('calls .close on the PeerConnectionManager', () => {
        var test = makeTest();
        test.room.disconnect();
        assert(test.peerConnectionManager.close.calledOnce);
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

      it('should stop the periodic calls to .publishEvent on the underlying Transport', async () => {
        var publishEventCallCount;
        var test = makeTest({ statsPublishIntervalMs: 50 });
        var wait = ms => new Promise(resolve => setTimeout(resolve, ms));

        await wait(175);
        publishEventCallCount = test.transport.publishEvent.callCount;
        test.room.disconnect();

        await wait(100);
        sinon.assert.callCount(test.transport.publishEvent, publishEventCallCount);
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
    context('multiple Track events in the same tick', () => {
      context('two "trackAdded" events', () => {
        it('should call .setMediaStreamTracksAndDataTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaStreamTracks', async () => {
          const localTracks = [makeTrack(), makeTrack()];
          const test = makeTest({ localTracks });
          localTracks.forEach(track => test.localParticipant.emit('trackAdded', track));
          await new Promise(resolve => setTimeout(resolve));
          sinon.assert.callCount(test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders, 1);
          assert.deepEqual(localTracks.map(track => track.mediaStreamTrackOrDataTrackTransceiver),
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders.args[0][0]);
        });
      });
    });

    context('"trackAdded" event followed by "trackRemoved" event', () => {
      it('should call .setMediaStreamTracksAndDataTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaStreamTracks', async () => {
        const [track, addedTrack, removedTrack] = [makeTrack(), makeTrack(), makeTrack()];
        const test = makeTest({ localTracks: [track, addedTrack] });
        test.localParticipant.emit('trackAdded', addedTrack);
        test.localParticipant.emit('trackRemoved', removedTrack);
        await new Promise(resolve => setTimeout(resolve));
        sinon.assert.callCount(test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders, 1);
        assert.deepEqual([ track.mediaStreamTrackOrDataTrackTransceiver, addedTrack.mediaStreamTrackOrDataTrackTransceiver ],
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders.args[0][0]);
      });
    });

    context('two "trackRemoved" events', () => {
      it('should call .setMediaStreamTracksAndDataTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaStreamTracks', async () => {
        const [track, removedTrack1, removedTrack2] = [makeTrack(), makeTrack(), makeTrack()];
        const test = makeTest({ localTracks: [track] });
        test.localParticipant.emit('trackRemoved', removedTrack1);
        test.localParticipant.emit('trackRemoved', removedTrack2);
        await new Promise(resolve => setTimeout(resolve));
        sinon.assert.callCount(test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders, 1);
        assert.deepEqual([ track.mediaStreamTrackOrDataTrackTransceiver ],
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders.args[0][0]);
      });
    });

    context('"trackAdded" event', () => {
      it('calls .setMediaStreamTracksAndDataTrackSenders with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaStreamTracks on the PeerConnectionManager', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        await new Promise(resolve => setTimeout(resolve));
        assert.deepEqual([track.mediaStreamTrackOrDataTrackTransceiver],
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders.args[0][0]);
      });

      it('calls .update on the LocalParticipantSignaling', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        await new Promise(resolve => setTimeout(resolve));
        assert(test.localParticipant.incrementRevision.calledOnce);
      });

      it('calls .publish on the Transport with the LocalparticipantSignaling state', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        await new Promise(resolve => setTimeout(resolve));
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
      it('calls .setMediaStreamTracksAndDataTrackSenders with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaStreams on the PeerConnectionManager', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        await new Promise(resolve => setTimeout(resolve));
        assert.deepEqual(
          [track.mediaStreamTrackOrDataTrackTransceiver],
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders.args[0][0]);
      });

      it('calls .update on the LocalParticipantSignaling', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        await new Promise(resolve => setTimeout(resolve));
        assert(test.localParticipant.incrementRevision.calledOnce);
      });

      it('calls .publish on the Transport with the LocalParticipantSignaling state', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        await new Promise(resolve => setTimeout(resolve));
        assert.deepEqual(
          {
            participant: {
              revision: 1
            }
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('when an added TrackV2 emits an "updated" event in a new state', () => {
      context('with .isEnabled set to false', () => {
        it('calls .publish on the Transport with the LocalParticipantSignaling state', () => {
          const track = makeTrack();
          const test = makeTest({
            localTracks: [track]
          });
          track.disable();
          assert.deepEqual(
            {
              participant: {
                revision: 1
              }
            },
            test.transport.publish.args[0][0]);
        });
      });

      context('with .isEnabled set to true', () => {
        it('calls .publish on the Transport with the LocalParticipantSignaling state', () => {
          const track = makeTrack();
          const test = makeTest({
            localTracks: [track]
          });
          track.enable();
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

    context('when a removed TrackV2 emits an "updated" event in a new state', () => {
      context('with .isEnabled set to false"', () => {
        it('does not call .publish on the Transport', () => {
          const track = makeTrack();
          const test = makeTest({
            localTracks: [track]
          });
          test.localParticipant.emit('trackRemoved', track);
          track.disable();
          assert(!test.transport.publish.calledTwice);
        });
      });

      context('with .isEnabled set to true', () => {
        it('does not call .publish on the Transport', () => {
          const track = makeTrack();
          const test = makeTest({
            localTracks: [track]
          });
          test.localParticipant.emit('trackRemoved', track);
          track.enable();
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

    context('when the PeerConnectionManager emits a "trackAdded" event for a MediaStreamTrack with an ID that has', () => {
      context('never been used before', () => {
        context('before the getMediaStreamTrackOrDataTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getMediaStreamTrackOrDataTrackTransceiver resolves to the MediaStreamTrack', () => {
            var test = makeTest({
              participants: [
                { sid: makeSid() }
              ]
            });
            var id = makeId();
            var mediaStreamTrack = { id: id };
            test.peerConnectionManager.emit('trackAdded', mediaStreamTrack);
            return test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id).then(track => {
              assert.equal(mediaStreamTrack, track);
            });
          });
        });

        context('after the getMediaStreamTrackOrDataTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getMediaStreamTrackOrDataTrackTransceiver resolves to the MediaStreamTrack', () => {
            var test = makeTest({
              participants: [
                { sid: makeSid() }
              ]
            });
            var id = makeId();
            var mediaStreamTrack = { id: id };
            var promise = test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id);
            test.peerConnectionManager.emit('trackAdded', mediaStreamTrack);
            return promise.then(track => {
              assert.equal(mediaStreamTrack, track);
            });
          });
        });
      });

      context('been used before', () => {
        context('before the getMediaStreamTrackOrDataTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getMediaStreamTrackOrDataTrackTransceiver resolves to the MediaStreamTrack', () => {
            var test = makeTest({
              participants: [
                { sid: makeSid() }
              ]
            });

            var id = makeId();
            var mediaStreamTrack1 = { id: id };
            var mediaStreamTrack2 = { id: id };

            // First usage
            test.peerConnectionManager.emit('trackAdded', mediaStreamTrack1);
            return test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id).then(() => {

              // Second usage
              test.peerConnectionManager.emit('trackAdded', mediaStreamTrack2);
              return test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id);
            }).then(track2 => {
              assert.equal(mediaStreamTrack2, track2);
            });
          });
        });

        context('after the getMediaStreamTrackOrDataTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getMediaStreamTrackOrDataTrackTransceiver resolves to the MediaStreamTrack', () => {
            var test = makeTest({
              participants: [
                { sid: makeSid() }
              ]
            });

            var id = makeId();
            var mediaStreamTrack1 = { id: id };
            var mediaStreamTrack2 = { id: id };

            // First usage
            var promise = test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id);
            test.peerConnectionManager.emit('trackAdded', mediaStreamTrack1);
            return promise.then(pair => {

              // Second usage
              promise = test.participantV2s[0].getMediaStreamTrackOrDataTrackTransceiver(id);
              test.peerConnectionManager.emit('trackAdded', mediaStreamTrack2);
              return promise;
            }).then(track2 => {
              assert.equal(mediaStreamTrack2, track2);
            });
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

    context('.participant', () => {
      it('should update the newly published LocalTrackV2s with their corresponding SIDs', () => {
        var id = makeId();
        var sid = makeSid();
        var test = makeTest();
        var track = makeTrack({ id });

        test.room.localParticipant.tracks.set(track.id, track);
        test.transport.emit('message', {
          participant: {
            sid: 'bar',
            tracks: [
              { id: id }
            ]
          },
          published: {
            revision: 1,
            tracks: [
              { id, sid, state: 'ready' }
            ]
          }
        });
        assert.equal(track.sid, sid);
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
  options.localTracks = (options.localTracks || []).map(track => {
    const eventEmitter = new EventEmitter();
    return Object.assign(eventEmitter, track);
  });
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);

  // NOTE(mroberts): The following is a little janky; we should improve this
  // test as we look to add Track SIDs to the stats.
  // eslint-disable-next-line no-use-before-define
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(() => room);

  options.transport = options.transport || makeTransport(options);

  const room = options.room = options.room || makeRoomV2(options);

  options.state = function state() {
    return new RoomStateBuilder(room);
  };

  return options;
}

function makeRemoteParticipantV2Constructor(testOptions) {
  testOptions = testOptions || {};
  testOptions.participantV2s = [];

  function RemoteParticipantV2(initialState, getMediaStreamTrackOrDataTrackTransceiver) {
    EventEmitter.call(this);
    this.tracks = (initialState.tracks || []).reduce((tracks, track) => tracks.set(track.sid, track), new Map());
    this.state = initialState.state || 'connected';
    this.sid = initialState.sid;
    this.getMediaStreamTrackOrDataTrackTransceiver = getMediaStreamTrackOrDataTrackTransceiver;
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
  transport.publishEvent = sinon.spy(() => {});
  transport.sync = sinon.spy(() => {});
  return transport;
};

function makePeerConnectionManager(getRoom) {
  const peerConnectionManager = new EventEmitter();
  peerConnectionManager.close = sinon.spy(() => {});
  peerConnectionManager.dequeue = sinon.spy(() => {});
  peerConnectionManager.setMediaStreamTracksAndDataTrackSenders = sinon.spy(() => {});
  peerConnectionManager.getRemoteMediaStreamTracksAndDataTrackReceivers = sinon.spy(() => []);

  peerConnectionManager.getStats = async () => {
    const room = getRoom();

    // NOTE(mroberts): We're going to add bogus stats entries to represent stats
    // for unannounced Tracks.

    const localTracks = [...room.localParticipant.tracks.values()];
    const localAudioTrackStats = localTracks
      .filter(track => track.kind === 'audio')
      .map(track => ({ trackId: track.id }))
      .concat([
        { trackId: 'bogus1', kind: 'audio' }
      ]);
    const localVideoTrackStats = localTracks
      .filter(track => track.kind === 'video')
      .map(track => ({ trackId: track.id }))
      .concat([
        { trackId: 'bogus2', kind: 'video' }
      ]);

    const remoteTracks = flatMap([...room.participants.values()], participant => [...participant.tracks.values()]);
    const remoteAudioTrackStats = remoteTracks
      .filter(track => track.kind === 'audio')
      .map(track => ({ trackId: track.id }))
      .concat([
        { trackId: 'bogus3', kind: 'audio' }
      ]);
    const remoteVideoTrackStats = remoteTracks
      .filter(track => track.kind === 'video')
      .map(track => ({ trackId: track.id }))
      .concat([
        { trackId: 'bogus4', kind: 'video' }
      ]);

    return [{
      localAudioTrackStats,
      localVideoTrackStats,
      peerConnectionId: 'foo',
      remoteAudioTrackStats,
      remoteVideoTrackStats
    }, {
      localAudioTrackStats,
      localVideoTrackStats,
      peerConnectionId: 'bar',
      remoteAudioTrackStats,
      remoteVideoTrackStats
    }];
  };

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

  localParticipant.connect = () => {};
  localParticipant.update = sinon.spy(localParticipantState => {
    localParticipantState.tracks.forEach(localTrackState => {
      const localTrackV2 = [...localParticipant.tracks.values()].find(track => track.id === localTrackState.id);
      if (localTrackV2) {
        localTrackV2.sid = localTrackState.sid;
      }
    });
  });

  localParticipant.incrementRevision = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.localTracks.reduce((tracks, track) => tracks.set(track.id, track), new Map());
  localParticipant.disconnect = sinon.spy(() => {});
  return localParticipant;
}

function makeTrack(options) {
  var track = new EventEmitter();
  options = options || {};
  track.id = options.id || makeId();
  track.sid = null;
  track.mediaStreamTrackOrDataTrackTransceiver = {};
  track.disable = () => {
    track.isEnabled = false;
    track.emit('updated');
  };
  track.enable = () => {
    track.isEnabled = true;
    track.emit('updated');
  };
  return track;
}
