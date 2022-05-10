'use strict';

const assert = require('assert');
const { EventEmitter }  = require('events');
const { inherits } = require('util');
const sinon = require('sinon');

const { flatMap } = require('../../../../../lib/util');
const StatsReport = require('../../../../../lib/stats/statsreport');
const RoomV3 = require('../../../../../lib/signaling/v3/room');
const RealTrackPrioritySignaling = require('../../../../../lib/signaling/v2/trackprioritysignaling');
const RealTrackSubscriptionsSignaling = require('../../../../../lib/signaling/v3/tracksubscriptionssignaling');

// eslint-disable-next-line no-warning-comments
const RemoteTrackPublicationV3 = require('../../../../../lib/signaling/v3/remotetrackpublication');


describe('RoomV3', () => {
  // RoomV3
  // ------

  describe('constructor', () => {
    it('sets .localParticipant', () => {
      const test = makeTest();
      assert.equal(
        test.localParticipant,
        test.room.localParticipant);
    });

    it('sets .name', () => {
      const test = makeTest();
      assert.equal(
        test.name,
        test.room.name);
    });

    it('sets .sid', () => {
      const test = makeTest();
      assert.equal(
        test.sid,
        test.room.sid);
    });

    it('sets the .state to "connected"', () => {
      const test = makeTest();
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

      const reports = {
        bar: new StatsReport('bar', {
          localAudioTrackStats: [{ trackId: '1', trackSid: 'MT1' }],
          localVideoTrackStats: [{ trackId: '2', trackSid: 'MT2' }],
          remoteAudioTrackStats: [],
          remoteVideoTrackStats: []
        }, true),
        foo: new StatsReport('foo', {
          localAudioTrackStats: [{ trackId: '1', trackSid: 'MT1' }],
          localVideoTrackStats: [{ trackId: '2', trackSid: 'MT2' }],
          remoteAudioTrackStats: [],
          remoteVideoTrackStats: []
        }, true)
      };

      const expectedArgs = [
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'foo',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'active-ice-candidate-pair',
          {
            peerConnectionId: 'foo',
            includesRelayProtocol: true,
            relayProtocol: 'udp'
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'bar',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'active-ice-candidate-pair',
          {
            peerConnectionId: 'bar',
            includesRelayProtocol: false
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'foo',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'bar',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'foo',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'active-ice-candidate-pair',
          {
            peerConnectionId: 'foo',
            includesRelayProtocol: true,
            relayProtocol: 'udp'
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'bar',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'active-ice-candidate-pair',
          {
            peerConnectionId: 'bar',
            includesRelayProtocol: false
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'foo',
            audioTrackStats: reports.foo.remoteAudioTrackStats,
            localAudioTrackStats: reports.foo.localAudioTrackStats,
            localVideoTrackStats: reports.foo.localVideoTrackStats,
            videoTrackStats: reports.foo.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'stats-report',
          {
            peerConnectionId: 'bar',
            audioTrackStats: reports.bar.remoteAudioTrackStats,
            localAudioTrackStats: reports.bar.localAudioTrackStats,
            localVideoTrackStats: reports.bar.localVideoTrackStats,
            videoTrackStats: reports.bar.remoteVideoTrackStats
          }
        ]
      ];
      await wait(225);
      test.transport.publishEvent.args.slice(0, expectedArgs.length).forEach(([/* group */, name, /* level */, payload], i) => {
        if (name === 'stats-report') {
          assert.deepEqual(payload, expectedArgs[i][2]);
          return;
        }
        if (name === 'active-ice-candidate-pair') {
          if (expectedArgs[i][2].includesRelayProtocol) {
            assert(payload.relayProtocol);
          } else {
            assert(!payload.relayProtocol);
          }
        }
        assert.equal(payload.peerConnectionId, expectedArgs[i][2].peerConnectionId);
        const payloadProp = {
          foo: 'baz',
          bar: 'zee'
        }[expectedArgs[i][2].peerConnectionId];
        assert.equal(payload[payloadProp], expectedArgs[i][2][payloadProp]);
      });
    });

    context('.participants', () => {
      it('constructs a new ParticipantV3 for each Participant state', () => {
        const sid1 = makeParticipantSid();
        const sid2 = makeParticipantSid();
        const test = makeTest({
          participants: [
            { sid: sid1, tracks: [] },
            { sid: sid2, tracks: [] }
          ]
        });
        assert.equal(sid1, test.participantV3s[0].sid);
        assert.equal(sid2, test.participantV3s[1].sid);
      });

      it('adds the newly-constructed ParticipantV3s to the RoomV3\'s .participants Map', () => {
        const sid1 = makeParticipantSid();
        const sid2 = makeParticipantSid();
        const test = makeTest({
          participants: [
            { sid: sid1, tracks: [] },
            { sid: sid2, tracks: [] }
          ]
        });
        assert.equal(
          test.participantV3s[0],
          test.room.participants.get(sid1));
        assert.equal(
          test.participantV3s[1],
          test.room.participants.get(sid2));
      });

      it('calls .update with the Participants states on the newly-constructed ParticipantV3s', () => {
        const sid1 = makeParticipantSid();
        const sid2 = makeParticipantSid();
        const test = makeTest({
          participants: [
            { sid: sid1, foo: 'bar', tracks: [] },
            { sid: sid2, baz: 'qux', tracks: [] }
          ]
        });
        assert.deepEqual(
          { sid: sid1, foo: 'bar', tracks: [] },
          test.participantV3s[0].update.args[0][0]);
        assert.deepEqual(
          { sid: sid2, baz: 'qux', tracks: [] },
          test.participantV3s[1].update.args[0][0]);
      });
    });

    context('.peer_connections', () => {
      it('calls .update with the .peer_connections on the PeerConnectionManager', () => {
        const test = makeTest({
          // eslint-disable-next-line camelcase
          peer_connections: { fizz: 'buzz' }
        });
        assert.deepEqual(
          { fizz: 'buzz' },
          test.peerConnectionManager.update.args[0][0]);
      });
    });

    context('PeerConnectionManager', () => {
      it('dequeues any enqueued "candidates" events', () => {
        const test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('candidates'));
      });

      it('dequeues any enqueued "description" events', () => {
        const test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('description'));
      });

      it('dequeues any enqueued "trackAdded" events', () => {
        const test = makeTest();
        assert(test.peerConnectionManager.dequeue.calledWith('trackAdded'));
      });
    });
  });

  // RoomSignaling
  // -------------

  describe('#connectParticipant, called when the ParticipantV3 was', () => {
    context('previously connected', () => {
      it('returns false', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        assert.equal(
          false,
          test.room.connectParticipant(test.participantV3s[0]));
      });

      it('the ParticipantV3 remains in the RoomV3\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.connectParticipant(test.participantV3s[0]);
        assert.equal(
          test.participantV3s[0],
          test.room.participants.get(test.participantV3s[0].sid));
      });

      it('does not emit the "participantConnected" event', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        let participantConnected = false;
        test.room.once('participantConnected', () => { participantConnected = true; });
        test.room.connectParticipant(test.participantV3s[0]);
        assert(!participantConnected);
      });
    });

    context('not previously connected', () => {
      it('returns true', () => {
        const RemoteParticipantV3 = makeRemoteParticipantV3Constructor();
        const participant = new RemoteParticipantV3({ sid: makeSid() });
        const test = makeTest();
        assert.equal(
          true,
          test.room.connectParticipant(participant));
      });

      it('adds the ParticipantV3 to the RoomV3\'s .participants Map', () => {
        const RemoteParticipantV3 = makeRemoteParticipantV3Constructor();
        const participant = new RemoteParticipantV3({ sid: makeSid() });
        const test = makeTest();
        test.room.connectParticipant(participant);
        assert.equal(
          participant,
          test.room.participants.get(participant.sid));
      });

      it('emits the "participantConnected" event with the ParticipantV3', () => {
        const RemoteParticipantV3 = makeRemoteParticipantV3Constructor();
        const participant = new RemoteParticipantV3({ sid: makeSid() });
        const test = makeTest();
        let participantConnected;
        test.room.once('participantConnected', participant => { participantConnected = participant; });
        test.room.connectParticipant(participant);
        assert.equal(
          participant,
          participantConnected);
      });
    });
  });

  // eslint-disable-next-line no-warning-comments
  // TODO(mmalavalli): Enable once RoomV3.getstats() is implemented.
  describe.skip('#getStats', () => {
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
        participants: [
          {
            identity: 'alice',
            sid: 'PA1',
            state: 'connected',
            tracks: [
              makeRemoteTrack({ id: '3', kind: 'audio', sid: 'MT3' })
            ]
          },
          {
            identity: 'bob',
            sid: 'PA2',
            state: 'connected',
            tracks: [
              makeRemoteTrack({ id: '4', kind: 'video', sid: 'MT4' })
            ]
          }
        ]
      });

      const reports = await test.room.getStats();
      const localAudioTrackStats = [
        { trackId: '1', trackSid: 'MT1' }
      ];
      const localVideoTrackStats = [
        { trackId: '2', trackSid: 'MT2' }
      ];
      const remoteAudioTrackStats = [
        { trackId: '3', trackSid: 'MT3' }
      ];
      const remoteVideoTrackStats = [
        { trackId: '4', trackSid: 'MT4' }
      ];
      assert.deepEqual([...reports.values()], [
        {
          activeIceCandidatePair: {
            includesRelayProtocol: true,
            relayProtocol: 'udp'
          },
          localAudioTrackStats,
          localVideoTrackStats,
          remoteAudioTrackStats,
          remoteVideoTrackStats
        },
        {
          activeIceCandidatePair: { includesRelayProtocol: false },
          localAudioTrackStats,
          localVideoTrackStats,
          remoteAudioTrackStats,
          remoteVideoTrackStats
        }
      ]);
    });
  });

  describe('#disconnect, called when the RoomV3 .state is', () => {
    context('"connected"', () => {
      it('returns true', () => {
        const test = makeTest();
        assert.equal(
          true,
          test.room.disconnect());
      });

      it('sets the .state to "disconnected"', () => {
        const test = makeTest();
        test.room.disconnect();
        assert.equal(
          'disconnected',
          test.room.state);
      });

      it('emits the "stateChanged" event with the new state "disconnected"', () => {
        const test = makeTest();
        let newState;
        test.room.once('stateChanged', state => { newState = state; });
        test.room.disconnect();
        assert.equal(
          'disconnected',
          newState);
      });

      it('calls .close on the PeerConnectionManager', () => {
        const test = makeTest();
        test.room.disconnect();
        assert(test.peerConnectionManager.close.calledOnce);
      });

      it('calls .disconnect on the Transport', () => {
        const test = makeTest();
        test.room.disconnect();
        assert(test.transport.disconnect.calledOnce);
      });

      it('does not call .disconnect on any connected ParticipantV3\'s', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.participantV3s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV3\'s from the RoomV3\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.participantV3s.forEach(participant => {
          assert.equal(
            participant,
            test.room.participants.get(participant.sid));
        });
      });

      it('does not emit any "participantDisconnected" events', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        let participantDisconnected;
        test.room.once('participantDisconnected', () => { participantDisconnected = true; });
        test.room.disconnect();
        assert(!participantDisconnected);
      });

      it('should stop the periodic calls to .publishEvent on the underlying Transport', async () => {
        let publishEventCallCount;
        const test = makeTest({ statsPublishIntervalMs: 50 });
        function wait(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        await wait(175);
        publishEventCallCount = test.transport.publishEvent.callCount;
        test.room.disconnect();

        await wait(100);
        sinon.assert.callCount(test.transport.publishEvent, publishEventCallCount);
      });
    });

    context('"disconnected"', () => {
      it('returns false', () => {
        const test = makeTest();
        test.room.disconnect();
        assert.equal(
          false,
          test.room.disconnect());
      });

      it('the .state remains "disconnected"', () => {
        const test = makeTest();
        test.room.disconnect();
        test.room.disconnect();
        assert.equal(
          'disconnected',
          test.room.state);
      });

      it('does not emit the "stateChanged" event', () => {
        const test = makeTest();
        test.room.disconnect();
        let stateChanged;
        test.room.once('stateChanged', () => { stateChanged = true; });
        test.room.disconnect();
        assert(!stateChanged);
      });

      it('does not call .disconnect on the Transport', () => {
        const test = makeTest();
        test.room.disconnect();
        test.room.disconnect();
        assert(!test.transport.disconnect.calledTwice);
      });

      it('does not call .disconnect on any connected ParticipantV3\'s', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.room.disconnect();
        test.participantV3s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV3\'s from the RoomV3\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.room.disconnect();
        test.participantV3s.forEach(participant => {
          assert.equal(
            participant,
            test.room.participants.get(participant.sid));
        });
      });

      it('does not emit any "participantDisconnected" events', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        let participantDisconnected;
        test.room.once('participantDisconnected', () => { participantDisconnected = true; });
        test.room.disconnect();
        assert(!participantDisconnected);
      });
    });
  });

  describe('"participantDisconnected" event', () => {
    context('when a connected ParticipantV3 emits a "stateChanged" event with a new state "disconnected"', () => {
      it('removes the ParticipantV3 from the RoomV3\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.participantV3s[0].emit('stateChanged', 'disconnected');
        assert(!test.room.participants.has(test.participantV3s[0].sid));
      });

      it('emits the "participantDisconnected" event with the ParticipantV3', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        let participantDisconnected;
        test.room.once('participantDisconnected', participant => { participantDisconnected = participant; });
        test.participantV3s[0].emit('stateChanged', 'disconnected');
        assert.equal(
          test.participantV3s[0],
          participantDisconnected);
      });
    });
  });

  describe('LocalParticipantSignaling', () => {
    context('multiple Track events in the same tick', () => {
      context('two "trackAdded" events', () => {
        it('should call .setTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaTrackSenders', async () => {
          const localTracks = [makeTrack(), makeTrack()];
          const test = makeTest({ localTracks });
          localTracks.forEach(track => test.localParticipant.emit('trackAdded', track));
          await new Promise(resolve => setTimeout(resolve));
          sinon.assert.callCount(test.peerConnectionManager.setTrackSenders, 1);
          assert.deepEqual(localTracks.map(track => track.trackTransceiver),
            test.peerConnectionManager.setTrackSenders.args[0][0]);
        });
      });
    });

    context('"trackAdded" event followed by "trackRemoved" event', () => {
      it('should call .setTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaTrackSenders', async () => {
        const [track, addedTrack, removedTrack] = [makeTrack(), makeTrack(), makeTrack()];
        const test = makeTest({ localTracks: [track, addedTrack] });
        test.localParticipant.emit('trackAdded', addedTrack);
        test.localParticipant.emit('trackRemoved', removedTrack);
        await new Promise(resolve => setTimeout(resolve));
        sinon.assert.callCount(test.peerConnectionManager.setTrackSenders, 1);
        assert.deepEqual([track.trackTransceiver, addedTrack.trackTransceiver],
          test.peerConnectionManager.setTrackSenders.args[0][0]);
      });
    });

    context('two "trackRemoved" events', () => {
      it('should call .setTrackSenders once on the underlying PeerConnectionManager with the corresponding MediaTrackSenders', async () => {
        const [track, removedTrack1, removedTrack2] = [makeTrack(), makeTrack(), makeTrack()];
        const test = makeTest({ localTracks: [track] });
        test.localParticipant.emit('trackRemoved', removedTrack1);
        test.localParticipant.emit('trackRemoved', removedTrack2);
        await new Promise(resolve => setTimeout(resolve));
        sinon.assert.callCount(test.peerConnectionManager.setTrackSenders, 1);
        assert.deepEqual([track.trackTransceiver],
          test.peerConnectionManager.setTrackSenders.args[0][0]);
      });
    });

    context('"trackAdded" event', () => {
      it('calls .setTrackSenders with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaTrackSenders on the PeerConnectionManager', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        await new Promise(resolve => setTimeout(resolve));
        assert.deepEqual([track.trackTransceiver],
          test.peerConnectionManager.setTrackSenders.args[0][0]);
      });

      it('calls .publish on the Transport with the LocalparticipantSignaling state', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackAdded', track);
        test.localParticipant.revision++;
        test.localParticipant.emit('updated');
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
      it('calls .setTrackSenders with the LocalParticipantSignaling\'s LocalTrackSignalings\' MediaTrackSenders on the PeerConnectionManager', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        await new Promise(resolve => setTimeout(resolve));
        assert.deepEqual(
          [track.trackTransceiver],
          test.peerConnectionManager.setTrackSenders.args[0][0]);
      });

      it('calls .publish on the Transport with the LocalParticipantSignaling state', async () => {
        const track = makeTrack();
        const test = makeTest({
          localTracks: [track]
        });
        test.localParticipant.emit('trackRemoved', track);
        test.localParticipant.revision++;
        test.localParticipant.emit('updated', track);
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
        const test = makeTest();
        test.peerConnectionManager.emit('description', { fizz: 'buzz' });
        assert.deepEqual(
          {
            participant: {
              revision: 0
            },
            // eslint-disable-next-line camelcase
            peer_connections: [
              { fizz: 'buzz' }
            ]
          },
          test.transport.publish.args[0][0]);
      });
    });

    context('when the PeerConnectionManager emits a "candidates" event', () => {
      it('calls .publish on the Transport with the PeerConnectionManager\'s new candidates', () => {
        const test = makeTest();
        test.peerConnectionManager.emit('candidates', { fizz: 'buzz' });
        assert.deepEqual(
          {
            participant: {
              revision: 0
            },
            // eslint-disable-next-line camelcase
            peer_connections: [
              { fizz: 'buzz' }
            ]
          },
          test.transport.publish.args[0][0]);
      });
    });
  });

  describe('when the Transport emits an "message" event containing Room state', () => {
    context('when the .name changes', () => {
      it('the .name remains the same', () => {
        const test = makeTest();
        test.transport.emit('message', {
          name: makeName(),
          participants: [],
          // eslint-disable-next-line camelcase
          peer_connections: []
        });
        assert.equal(
          test.name,
          test.room.name);
      });
    });

    context('when the .sid changes', () => {
      it('the .sid remains the same', () => {
        const test = makeTest();
        test.transport.emit('message', {
          participants: [],
          // eslint-disable-next-line camelcase
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
        const id = makeId();
        const sid = makeSid();
        const test = makeTest();
        const track = makeTrack({ id });

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
          it('constructs a new ParticipantV3 with the Participant state', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert.equal(
              sid,
              test.participantV3s[0].sid);
          });

          it('adds the newly-constructed ParticipantV3 to the RoomV3\'s .participants Map', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert.equal(
              test.participantV3s[0],
              test.room.participants.get(sid));
          });

          it('emits the "participantConnected" event with the newly-constructed ParticipantV3', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            let participantConnected;
            test.room.once('participantConnected', participant => { participantConnected = participant; });
            test.transport.emit('message', {
              participants: [
                { sid: sid, tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert.equal(
              test.participantV3s[0],
              participantConnected);
          });

          it('calls .update with the Participant state on the newly-constructed ParticipantV3', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, fizz: 'buzz', tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert.deepEqual(
              { sid: sid, fizz: 'buzz', tracks: [] },
              test.participantV3s[0].update.args[0][0]);
          });
        });

        context('and the Participant state\'s .state is "disconnected"', () => {
          it('constructs a new ParticipantV3 with the Participant state', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected', tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert.equal(
              sid,
              test.participantV3s[0].sid);
          });

          it('does not add the newly-constructed ParticipantV3 to the RoomV3\'s .participants Map', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected', tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert(!test.room.participants.has(sid));
          });

          it('does not emit a "participantConnected" event', () => {
            const test = makeTest();
            const sid = makeParticipantSid();
            let participantConnected;
            test.room.once('participantConnected', () => { participantConnected = true; });
            test.transport.emit('message', {
              participants: [
                { sid: sid, state: 'disconnected', tracks: [] }
              ],
              // eslint-disable-next-line camelcase
              peer_connections: []
            });
            assert(!participantConnected);
          });
        });
      });

      context('when .participants includes a Participant state for a connected ParticipantV3', () => {
        it('calls .update with the Participant state on the ParticipantV3', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz', tracks: [] }
            ],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert.deepEqual(
            { sid: sid, fizz: 'buzz', tracks: [] },
            test.participantV3s[0].update.args[1][0]);
        });
      });

      context('when .participants includes a Participant state for a disconnected ParticipantV3', () => {
        [
          [2, 1],
          [2, 2],
          [2, 3]
        ].forEach(([revision, nextRevision]) => {
          context(`with ${nextRevision < revision
            ? 'an older revision'
            : nextRevision === revision
              ? 'the same revision'
              : 'with a newer revision'}`, () => {
            const shouldCreate = nextRevision > revision;
            it(`${shouldCreate ? 'constructs' : 'does not construct'} a new ParticipantV3 with the Participant state`, () => {
              const sid = makeParticipantSid();
              const test = makeTest({
                participants: [
                  { sid: sid, revision, tracks: [] }
                ]
              });
              test.participantV3s[0].emit('stateChanged', 'disconnected');
              test.transport.emit('message', {
                participants: [
                  { sid: sid, fizz: 'buzz', revision: nextRevision, tracks: [] }
                ],
                // eslint-disable-next-line camelcase
                peer_connections: []
              });
              assert.equal(
                shouldCreate ? 2 : 1,
                test.participantV3s.length);
            });
          });
        });

        it('does not call .update with the Participant state on the disconnected ParticipantV3', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.participantV3s[0].emit('stateChanged', 'disconnected');
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz', tracks: [] }
            ],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert(!test.participantV3s[0].update.calledTwice);
        });
      });

      context('when .participants omits a Participant state for a connected ParticipantV3', () => {
        ['connected', 'synced', 'update'].forEach(type => {
          context(`when processing a "${type}" RSP message`, () => {
            it(`should ${type === 'synced' ? '' : 'not '}call .disconnect on the ParticipantV3`, () => {
              const sid = makeParticipantSid();
              const test = makeTest({
                participants: [
                  { sid: sid, tracks: [] }
                ]
              });
              test.transport.emit('message', {
                participants: [],
                // eslint-disable-next-line camelcase
                peer_connections: [],
                type
              });
              assert.equal(
                type === 'synced',
                test.participantV3s[0].disconnect.calledOnce);
            });

            it(`should ${type === 'synced' ? '' : 'not '}retain the ParticipantV3 remains in the RoomV3's .participants Map`, () => {
              const sid = makeParticipantSid();
              const test = makeTest({
                participants: [
                  { sid: sid, tracks: [] }
                ]
              });
              test.transport.emit('message', {
                participants: [],
                // eslint-disable-next-line camelcase
                peer_connections: [],
                type
              });
              if (type === 'synced') {
                assert(!test.room.participants.has(sid));
              } else {
                assert.equal(
                  test.participantV3s[0],
                  test.room.participants.get(sid));
              }
            });

            it(`shound ${type === 'synced' ? '' : 'not '}emit a "participantDisconnected" event`, () => {
              const sid = makeParticipantSid();
              const test = makeTest({
                participants: [
                  { sid: sid, tracks: [] }
                ]
              });
              let participantDisconnected;
              test.room.once('participantDisconnected', () => { participantDisconnected = true; });
              test.transport.emit('message', {
                participants: [],
                // eslint-disable-next-line camelcase
                peer_connections: [],
                type
              });
              assert.equal(type === 'synced',
                !!participantDisconnected);
            });
          });
        });
      });
    });

    context('.peer_connections', () => {
      it('calls .update with the .peer_connections on the PeerConnectionManager', () => {
        const test = makeTest();
        test.transport.emit('message', {
          participants: [],
          // eslint-disable-next-line camelcase
          peer_connections: { fizz: 'buzz' }
        });
        assert.deepEqual(
          { fizz: 'buzz' },
          test.peerConnectionManager.update.args[0][0]);
      });
    });
  });

  describe('TrackPrioritySignaling', () => {
    let TrackPrioritySignaling;
    let trackPrioritySignaling1;
    let test;

    before(() => {
      TrackPrioritySignaling = sinon.spy(function(a, b, c, d) {
        const trackPrioritySignaling =  new RealTrackPrioritySignaling(a, b, c, d);
        if (!trackPrioritySignaling1) {
          trackPrioritySignaling1 = trackPrioritySignaling;
        }
        return trackPrioritySignaling;
      });

      const mediaStreamTrack1 = { id: '3', kind: 'audio' };
      const mediaStreamTrack2 = { id: '4', kind: 'video' };
      const trackReceiver1 = makeTrackReceiver(mediaStreamTrack1);
      const trackReceiver2 = makeTrackReceiver(mediaStreamTrack2);

      const peerConnectionManager = makePeerConnectionManager([], []);
      peerConnectionManager.getTrackReceivers = () => [trackReceiver1, trackReceiver2];

      test = makeTest({
        peerConnectionManager,
        TrackPrioritySignaling,
        localTracks: [{ id: '1', kind: 'audio' }, { id: '2', kind: 'video' }]
      });

      test.room._update({
        published: {
          revision: 1,
          tracks: [{ id: '1', sid: 'MT1' }, { id: '2', sid: 'MT2' }]
        },
        participants: [
          {
            identity: 'alice',
            sid: 'PA1',
            state: 'connected',
            tracks: [makeRemoteTrack({ id: '3', kind: 'audio', priority: 'standard', sid: 'MT3' })]
          },
          {
            identity: 'bob',
            sid: 'PA2',
            state: 'connected',
            tracks: [makeRemoteTrack({ id: '4', kind: 'video', priority: 'standard', sid: 'MT4' })]
          }
        ]
      });
    });

    describe('when an incoming connect/update RSP message contains the RTCDataChannel ID of the TrackPriority MSP', () => {
      before(() => {
        test.transport.emit('message', {
          // eslint-disable-next-line
          media_signaling: {
            // eslint-disable-next-line
            track_priority: {
              transport: { type: 'data-channel', label: 'foo' }
            }
          }
        });
      });

      describe('should wait for a DataTrackReceiver with the expected label to be available, and', () => {
        let dataTrackReceiver1;
        let dataTrackReceiver2;
        let dataTrackTransport1;
        let dataTrackTransport2;

        before(async () => {
          dataTrackTransport1 = new EventEmitter();
          dataTrackTransport1.stop = sinon.spy();
          dataTrackReceiver1 = makeTrackReceiver({ id: 'foo', kind: 'data' });
          dataTrackReceiver1.toDataTransport = sinon.spy(() => dataTrackTransport1);
          test.peerConnectionManager.emit('trackAdded', dataTrackReceiver1);
          await test.room._getTrackReceiver(dataTrackReceiver1.id);
        });

        it('converts the DataTrackReciever to a DataTrackTransport,', () => {
          sinon.assert.callCount(dataTrackReceiver1.toDataTransport, 1);
        });

        describe('when the underlying DataTrackReceiver is closed and a new one is available, and', () => {
          before(() => {
            dataTrackReceiver1.emit('close');
            dataTrackTransport2 = new EventEmitter();
            dataTrackTransport2.stop = sinon.spy();
            dataTrackReceiver2 = makeTrackReceiver({ id: 'bar', kind: 'data' });
            dataTrackReceiver2.toDataTransport = sinon.spy(() => dataTrackTransport2);
            test.peerConnectionManager.emit('trackAdded', dataTrackReceiver2);
          });

          describe('when an incoming connect/update RSP message contains the new RTCDataChannel ID of the TrackPriority MSP', () => {
            before(async () => {
              test.transport.emit('message', {
                // eslint-disable-next-line
                media_signaling: {
                  // eslint-disable-next-line
                  track_priority: {
                    transport: { type: 'data-channel', label: 'bar' }
                  }
                }
              });
              await test.room._getTrackReceiver(dataTrackReceiver2.id);
            });

            it('converts the new DataTrackReciever to a DataTrackTransport,', () => {
              sinon.assert.callCount(dataTrackReceiver2.toDataTransport, 1);
            });

          });
        });
      });
    });
  });

  describe('Track Subscriptions Signaling', () => {
    describe('when update is called with an RSP message that determines Track Subscriptions over RTCDataChannel', () => {
      let TrackSubscriptionsSignaling;
      let trackReceiver3;
      let trackReceiver4;
      let trackReceiver5;
      let trackReceiver6;
      let trackSubscriptionsSignaling;
      let test;
      beforeEach(() => {
        TrackSubscriptionsSignaling = sinon.spy(function(a, b, c, d) {
          trackSubscriptionsSignaling = new RealTrackSubscriptionsSignaling(a, b, c, d);
          return trackSubscriptionsSignaling;
        });

        const mediaStreamTrack3 = { id: '3', kind: 'audio' };
        const mediaStreamTrack4 = { id: '4', kind: 'video' };
        const mediaStreamTrack5 = { id: '5', kind: 'video' };
        trackReceiver3 = makeTrackReceiver(mediaStreamTrack3, '0');
        trackReceiver4 = makeTrackReceiver(mediaStreamTrack4, '1');
        trackReceiver5 = makeTrackReceiver(mediaStreamTrack5, '2');
        trackReceiver6 = makeTrackReceiver({ id: '6', kind: 'data' });

        const peerConnectionManager = makePeerConnectionManager([], []);
        peerConnectionManager.getTrackReceivers = () => [trackReceiver3, trackReceiver4, trackReceiver5, trackReceiver6];

        test = makeTest({
          peerConnectionManager,
          TrackSubscriptionsSignaling,
          localTracks: [{ id: '1', kind: 'audio' }, { id: '2', kind: 'video' }]
        });
        test.room._update({
          published: {
            revision: 1,
            tracks: [{ id: '1', sid: 'MT1' }, { id: '2', sid: 'MT2' }]
          },
          participants: [
            {
              identity: 'alice',
              sid: 'PA1',
              state: 'connected',
              tracks: [makeRemoteTrack({ id: '3', kind: 'audio', sid: 'MT3' })]
            },
            {
              identity: 'bob',
              sid: 'PA2',
              state: 'connected',
              tracks: [makeRemoteTrack({ id: '4', kind: 'video', sid: 'MT4' })]
            },
            {
              identity: 'charlie',
              sid: 'PA3',
              state: 'connected',
              tracks: [makeRemoteTrack({ id: '6', kind: 'data', sid: 'MT5' })]
            }
          ]
        });

        test.transport.emit('message', {
          // eslint-disable-next-line
          media_signaling: {
            // eslint-disable-next-line
            track_subscriptions: {
              transport: { type: 'data-channel', label: 'foo' }
            }
          }
        });
      });

      describe('waits for a DataTrackReceiver with the expected label, and', () => {
        let dataTrackReceiver;
        let dataTrackTransport;

        beforeEach(async () => {
          dataTrackTransport = new EventEmitter();
          dataTrackTransport.stop = sinon.spy();
          dataTrackReceiver = makeTrackReceiver({ id: 'foo', kind: 'data' });
          dataTrackReceiver.toDataTransport = sinon.spy(() => dataTrackTransport);
          test.peerConnectionManager.emit('trackAdded', dataTrackReceiver);
          await test.room._getTrackReceiver(dataTrackReceiver.id);

          dataTrackTransport.emit('message', {
            revision: 1,
            media: {
              MT3: { state: 'ON', mid: '0' },
              MT4: { state: 'ON', mid: '1' }
            },
            type: 'track_subscriptions'
          });

          await Promise.all([
            test.room._getTrackReceiver('0', 'mid'),
            test.room._getTrackReceiver('1', 'mid')
          ]);
        });

        it('converts the DataTrackReciever to a DataTrackTransport,', () => {
          assert(dataTrackReceiver.toDataTransport.calledOnce);
        });

        function getTrackSwitchPromise(room, trackSid, off) {
          const remoteTracks = flatMap([...room.participants.values()], participant => [...participant.tracks.values()]);
          const track = remoteTracks.find(track => track.sid === trackSid);
          const setTrackTransceiver = track.setTrackTransceiver;
          track.setTrackTransceiver = sinon.spy((...args) => setTrackTransceiver.apply(track, args));
          const setSwitchedOff = track.setSwitchedOff;
          track.setSwitchedOff = sinon.spy((...args) => setSwitchedOff.apply(track, args));
          return new Promise(resolve => track.on('updated', function onUpdated() {
            if (track.isSwitchedOff === off) {
              track.removeListener('updated', onUpdated);
              resolve(track);
            }
          }));
        }

        it('fires trackSwitchOff / On events and calls .setTrackTransceiver and .setSwitchedOff on the TrackSignalings when such message is received on data channel', async () => {
          const trackSid = 'MT3';
          const trackSwitchOffPromise = getTrackSwitchPromise(test.room, trackSid, true /* off */);
          dataTrackTransport.emit('message', {
            // eslint-disable-next-line camelcase
            media: { [trackSid]: { state: 'OFF', off_reason: 'bar' } },
            revision: 2,
            type: 'track_subscriptions'
          });
          let track = await trackSwitchOffPromise;
          sinon.assert.calledWith(track.setTrackTransceiver, null, true);
          sinon.assert.calledWith(track.setSwitchedOff, true, 'bar');

          const trackSwitchOnPromise = getTrackSwitchPromise(test.room, trackSid, false /* on */);
          dataTrackTransport.emit('message', {
            // eslint-disable-next-line camelcase
            media: { [trackSid]: { state: 'ON', mid: '0' } },
            revision: 3,
            type: 'track_subscriptions'
          });
          track = await trackSwitchOnPromise;
          await test.room._getTrackReceiver('0', 'mid');
          sinon.assert.calledWith(track.setTrackTransceiver, trackReceiver3, true);
          sinon.assert.calledWith(track.setSwitchedOff, false, null);
        });

        it('calls .setTrackTransceiver and sets .isSubscribed on the TrackSignalings for subscribed and unsubscribed Tracks', async () => {
          const tracks = flatMap(test.room.participants, participant => [...participant.tracks.values()]);
          const dataTrack = tracks.find(track => track.sid === 'MT5');
          const mediaTrack = tracks.find(track => track.sid === 'MT4');
          const dataSetTrackTransceiver = dataTrack.setTrackTransceiver;
          dataTrack.setTrackTransceiver = sinon.spy((...args) => dataSetTrackTransceiver.apply(dataTrack, args));
          const mediaSetTrackTransceiver = mediaTrack.setTrackTransceiver;
          mediaTrack.setTrackTransceiver = sinon.spy((...args) => mediaSetTrackTransceiver.apply(mediaTrack, args));

          dataTrackTransport.emit('message', {
            data: { MT5: { label: '6' } },
            // eslint-disable-next-line camelcase
            media: { MT3: { state: 'ON', mid: '0' } },
            revision: 2,
            type: 'track_subscriptions'
          });
          await test.room._getTrackReceiver('6');
          sinon.assert.calledWith(dataTrack.setTrackTransceiver, trackReceiver6);
          assert.equal(dataTrack.isSubscribed, true);
          sinon.assert.calledWith(mediaTrack.setTrackTransceiver, null);
          assert.equal(mediaTrack.isSubscribed, false);

          dataTrackTransport.emit('message', {
            data: {},
            // eslint-disable-next-line camelcase
            media: {
              MT3: { state: 'ON', mid: '0' },
              MT4: { state: 'ON', mid: '1' }
            },
            revision: 3,
            type: 'track_subscriptions'
          });
          await test.room._getTrackReceiver('1', 'mid');
          sinon.assert.calledWith(dataTrack.setTrackTransceiver, null);
          assert.equal(dataTrack.isSubscribed, false);
          sinon.assert.calledWith(mediaTrack.setTrackTransceiver, trackReceiver4);
          assert.equal(mediaTrack.isSubscribed, true);
        });

        it('calls .setTrackTransceiver and set .isSubscribed twice (unsubscribed and then subscribed) when a TrackSignaling\'s mid changes', async () => {
          const track = flatMap(test.room.participants, participant => [...participant.tracks.values()]).find(track => track.sid === 'MT4');
          const setTrackTransceiver = track.setTrackTransceiver;
          track.setTrackTransceiver = sinon.spy((...args) => setTrackTransceiver.apply(track, args));

          dataTrackTransport.emit('message', {
            media: {
              MT3: { state: 'ON', mid: '0' },
              MT4: { state: 'ON', mid: '2' }
            },
            revision: 2,
            type: 'track_subscriptions'
          });
          sinon.assert.calledWith(track.setTrackTransceiver, null);
          assert.equal(track.isSubscribed, false);

          await test.room._getTrackReceiver('2', 'mid');
          sinon.assert.calledWith(track.setTrackTransceiver, trackReceiver5);
          assert.equal(track.isSubscribed, true);
        });
      });
    });
  });

  describe('Dominant Speaker Signaling', () => {
    describe('when update is called with an RSP message that determines Active Speaker over RTCDataChannel', () => {
      let dominantSpeaker;
      let test;
      beforeEach(() => {

        test = makeTest({});

        test.room.on('dominantSpeakerChanged', () => {
          dominantSpeaker = test.room.dominantSpeakerSid;
        });

        test.transport.emit('message', {
          // eslint-disable-next-line
          media_signaling: {
            // eslint-disable-next-line
            active_speaker: {
              transport: { type: 'data-channel', label: 'foo' }
            }
          }
        });
      });

      describe('waits for a DataTrackReceiver with the expected label, and', () => {
        let dataTrackReceiver;
        let dataTrackTransport;

        beforeEach(async () => {
          dataTrackTransport = new EventEmitter();
          dataTrackTransport.stop = sinon.spy();

          dataTrackReceiver = makeTrackReceiver({ id: 'foo', kind: 'data' });
          dataTrackReceiver.toDataTransport = sinon.spy(() => dataTrackTransport);

          test.peerConnectionManager.emit('trackAdded', dataTrackReceiver);

          await new Promise(resolve => setTimeout(resolve));
        });

        it('converts the DataTrackReciever to a DataTrackTransport,', () => {
          assert(dataTrackReceiver.toDataTransport.calledOnce);
        });


        it('starts updating when the track emits "message"', () => {
          dataTrackTransport.emit('message', { type: 'active_speaker', participant: 'bob' });
          assert.equal(dominantSpeaker, 'bob');
          dataTrackTransport.emit('message', { type: 'active_speaker', participant: 'alice' });
          assert.equal(dominantSpeaker, 'alice');
        });

        describe('when the underlying DataTrackReceiver is closed, and new one is created', () => {
          let dataTrackTransport2;
          let dataTrackReceiver2;
          beforeEach(async () => {
            // emit close on old channel
            dataTrackReceiver.emit('close');
            await new Promise(resolve => setTimeout(resolve));
            dataTrackTransport2 = new EventEmitter();
            dataTrackTransport2.stop = sinon.spy();

            // send update message.
            test.transport.emit('message', {
              // eslint-disable-next-line
              media_signaling: {
                // eslint-disable-next-line
                active_speaker: {
                  transport: { type: 'data-channel', label: 'foo' }
                }
              }
            });

            // create another track receiver
            dataTrackReceiver2 = makeTrackReceiver({ id: 'foo', kind: 'data' });
            dataTrackReceiver2.toDataTransport = sinon.spy(() => dataTrackReceiver2);
            test.peerConnectionManager.emit('trackAdded', dataTrackReceiver2);
            await new Promise(resolve => setTimeout(resolve));
          });

          it('converts DataTrackReciever2 to a DataTrackTransport,', () => {
            assert(dataTrackReceiver2.toDataTransport.calledOnce);
          });


          it('starts updating when new track emits "message"', () => {
            dataTrackReceiver2.emit('message', { type: 'active_speaker', participant: 'Charlie' });
            assert.equal(dominantSpeaker, 'Charlie');

            dataTrackReceiver2.emit('message', { type: 'active_speaker', participant: 'alice' });
            assert.equal(dominantSpeaker, 'alice');
          });
        });
      });
    });
  });

  describe('Network Quality Signaling', () => {
    describe('when update is called with an RSP message that negotiates Network Quality Signaling over RTCDataChannel', () => {
      let networkQualityMonitor;
      let NetworkQualityMonitor;

      let test;

      beforeEach(() => {
        let instanceNumber = 0;
        NetworkQualityMonitor = sinon.spy(function() {
          networkQualityMonitor = new EventEmitter();
          networkQualityMonitor.instanceNumber = ++instanceNumber;
          networkQualityMonitor.setNetworkConfiguration = sinon.spy;
          networkQualityMonitor.start = sinon.spy();
          networkQualityMonitor.stop = sinon.spy();
          return networkQualityMonitor;
        });

        test = makeTest({
          NetworkQualityMonitor,
        });

        test.transport.emit('message', {
          // eslint-disable-next-line
          media_signaling: {
            // eslint-disable-next-line
            network_quality: {
              transport: { type: 'data-channel', label: ':-)' }
            }
          }
        });
      });

      describe('waits for a DataTrackReceiver with the expected label, and', () => {
        let dataTrackReceiver;
        let dataTrackTransport;

        beforeEach(async () => {
          dataTrackTransport = new EventEmitter();
          dataTrackTransport.stop = sinon.spy();

          dataTrackReceiver = makeTrackReceiver({ id: ':-)', kind: 'data' });
          dataTrackReceiver.toDataTransport = sinon.spy(() => dataTrackTransport);

          test.peerConnectionManager.emit('trackAdded', dataTrackReceiver);

          await new Promise(resolve => setTimeout(resolve));
        });

        it('converts the DataTrackReciever to a DataTrackTransport,', () => {
          assert(dataTrackReceiver.toDataTransport.calledOnce);
        });

        it('calls .start() on the NetworkQualityMonitor, and', () => {
          assert(networkQualityMonitor.start.calledOnce);
        });

        it('starts updating LocalParticipant NetworkQualityLevel when NetworkQualityMonitor emits "updated"', () => {
          // Case 1: ICE Connection State transitions to "failed", Network
          //         Quality Level has not been computed.
          test.localParticipant.networkQualityLevel = null;
          test.peerConnectionManager.iceConnectionState = 'failed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert.equal(test.localParticipant.setNetworkQualityLevel.callCount, 0);

          // Case 2: ICE Connection State is still "failed", and Network Quality
          //         Level is computed.
          networkQualityMonitor.level = 1;
          networkQualityMonitor.emit('updated');
          assert.equal(test.localParticipant.setNetworkQualityLevel.callCount, 0);

          // Case 3: ICE Connection State transitions to "completed"
          test.peerConnectionManager.iceConnectionState = 'completed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert.equal(test.localParticipant.setNetworkQualityLevel.callCount, 0);

          // Case 4: ICE Connection State is still "completed", and Network
          //         Quality Level is computed.
          networkQualityMonitor.level = 1;
          networkQualityMonitor.emit('updated');
          assert(test.localParticipant.setNetworkQualityLevel.calledWith(networkQualityMonitor.level));

          networkQualityMonitor.level = 4;
          networkQualityMonitor.emit('updated');
          assert(test.localParticipant.setNetworkQualityLevel.calledWith(networkQualityMonitor.level));

          // Case 5: ICE Connection State transitions to "failed"
          test.localParticipant.networkQualityLevel = networkQualityMonitor.level;
          test.peerConnectionManager.iceConnectionState = 'failed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert(test.localParticipant.setNetworkQualityLevel.calledWith(0));
        });

        it('starts updating RemoteParticipant NetworkQualityLevel when NetworkQualityMonitor emits "updated"', () => {
          const RemoteParticipantV3 = makeRemoteParticipantV3Constructor();
          const participant = new RemoteParticipantV3({ sid: makeSid() });
          test.room.connectParticipant(participant);

          // Case 1: ICE Connection State transitions to "failed", Network
          //         Quality Level has not been computed.
          participant.networkQualityLevel = null;
          test.peerConnectionManager.iceConnectionState = 'failed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert.equal(participant.setNetworkQualityLevel.callCount, 0);

          // Case 2: ICE Connection State is still "failed", and Network Quality
          //         Level is computed.
          networkQualityMonitor.remoteLevels = new Map().set(participant.sid, { sid: participant.sid, level: 1 });
          networkQualityMonitor.emit('updated');
          assert.equal(participant.setNetworkQualityLevel.callCount, 0);

          // Case 3: ICE Connection State transitions to "completed"
          test.peerConnectionManager.iceConnectionState = 'completed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert.equal(participant.setNetworkQualityLevel.callCount, 0);

          // Case 4: ICE Connection State is still "completed", and Network
          //         Quality Level is computed.
          networkQualityMonitor.remoteLevels = new Map().set(participant.sid, { sid: participant.sid, level: 1 });
          networkQualityMonitor.emit('updated');
          assert(participant.setNetworkQualityLevel.calledWith(1));

          networkQualityMonitor.remoteLevels = new Map().set(participant.sid, { sid: participant.sid, level: 1 });
          networkQualityMonitor.emit('updated');
          assert(participant.setNetworkQualityLevel.calledWith(1));

          // Case 5: ICE Connection State transitions to "failed"
          participant.networkQualityLevel = networkQualityMonitor.remoteLevels.get(participant.sid).level;
          test.peerConnectionManager.iceConnectionState = 'failed';
          test.peerConnectionManager.emit('iceConnectionStateChanged');
          assert(participant.setNetworkQualityLevel.calledWith(0));
        });

        describe('when the underlying DataTrackReceiver is closed', () => {
          let dataTrackTransport2;
          let dataTrackReceiver2;
          beforeEach(async () => {
            // emit close on old channel
            dataTrackReceiver.emit('close');
            await new Promise(resolve => setTimeout(resolve));
          });

          it('should tear down the networkQualityMonitor', () => {
            assert(networkQualityMonitor.stop.calledOnce);
            assert(networkQualityMonitor.instanceNumber === 1);
          });

          context('when a new DataTrackReceiver is created', () => {
            beforeEach(async () => {
              dataTrackTransport2 = new EventEmitter();
              dataTrackTransport2.stop = sinon.spy();

              // send update message.
              test.transport.emit('message', {
                // eslint-disable-next-line
                media_signaling: {
                  // eslint-disable-next-line
                  network_quality: {
                    transport: { type: 'data-channel', label: ':-)' }
                  }
                }
              });

              // create another track receiver
              dataTrackReceiver2 = makeTrackReceiver({ id: ':-)', kind: 'data' });
              dataTrackReceiver2.toDataTransport = sinon.spy(() => dataTrackReceiver2);
              test.peerConnectionManager.emit('trackAdded', dataTrackReceiver2);
              await new Promise(resolve => setTimeout(resolve));
            });

            it('converts DataTrackReciever2 to a DataTrackTransport,', () => {
              assert(dataTrackReceiver2.toDataTransport.calledOnce);
            });

            // it('constructs new NetworkQualitySignaling with the dataTrackReceiver2,', () => {
            //   assert(NetworkQualitySignaling.calledWith(dataTrackReceiver2));
            // });

            it('constructs a NetworkQualityMonitor with the NetworkQualitySignaling,', () => {
              // assert(NetworkQualityMonitor.calledWith(test.peerConnectionManager, networkQualitySignaling));
              assert(networkQualityMonitor.instanceNumber === 2);
            });

            it('calls .start() on the another instance of NetworkQualityMonitor', () => {
              assert(networkQualityMonitor.instanceNumber === 2);
              assert(networkQualityMonitor.start.calledOnce);
            });
          });
        });

        describe('then, when the RoomV3 finally disconnects,', () => {
          it('calls .stop() on the NetworkQualityMonitor', () => {
            test.room.disconnect();
            assert(networkQualityMonitor.stop.calledOnce);
          });
        });
      });

      describe('if the RoomV3 is disconnected before it gets the DataTrackReceiver', () => {
        let NetworkQualityMonitor;

        let test;

        beforeEach(() => {
          NetworkQualityMonitor = sinon.spy(function() {});

          test = makeTest({
            NetworkQualityMonitor
          });

          test.transport.emit('message', {
            // eslint-disable-next-line
            media_signaling: {
              // eslint-disable-next-line
              network_quality: {
                transport: { type: 'data-channel', label: ':-)' }
              }
            }
          });
        });

        it('then no NetworkQualitySignaling or NetworkQualityMonitor is created', async () => {
          test.room.disconnect();

          const dataTrackReceiver = makeTrackReceiver({ id: ':-)', kind: 'data' });
          test.peerConnectionManager.emit('trackAdded', dataTrackReceiver);

          await new Promise(resolve => setTimeout(resolve));

          assert(NetworkQualityMonitor.notCalled);
        });
      });
    });
  });
});

describe('"signalingConnectionStateChanged" event', () => {
  context('when the RoomV3\'s .signalingConnectionState is "reconnecting"', () => {
    it('should transition the LocalParticipantV3\'s .state to "reconnecting"', () => {
      const test = makeTest();
      let newState;
      test.localParticipant.once('stateChanged', state => { newState = state; });
      test.transport.sync();
      assert.equal(newState, 'reconnecting');
    });
  });

  context('when the RoomV3\'s .signalingConnectionState is "connected"', () => {
    it('should transition the LocalParticipantV3\'s .state to "connected"', () => {
      const test = makeTest();
      let newState;
      test.transport.sync();
      test.localParticipant.once('stateChanged', state => { newState = state; });
      test.transport.synced();
      assert.equal(newState, 'connected');
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
  let sid = 'RM';
  for (let i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeParticipantSid() {
  let sid = 'PA';
  for (let i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeTest(options) {
  options = options || {};

  options.name = options.name || makeName();
  options.sid = options.sid || makeSid();
  options.participants = options.participants || [];
  options.participantV3s = options.participantV3s || [];

  options.RemoteParticipantSignaling = options.RemoteParticipantSignaling || makeRemoteParticipantV3Constructor(options);
  options.localTracks = (options.localTracks || []).map(track => {
    track.trackTransceiver = new EventEmitter();
    const eventEmitter = new EventEmitter();
    return Object.assign(eventEmitter, track);
  });
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);

  // NOTE(mroberts): The following is a little janky; we should improve this
  // test as we look to add Track SIDs to the stats.
  // eslint-disable-next-line no-use-before-define
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(() => room);

  options.transport = options.transport || makeTransport(options);

  const room = options.room = options.room || makeRoomV3(options);

  options.state = function state() {
    return new RoomStateBuilder(room);
  };

  return options;
}

function makeRemoteParticipantV3Constructor(testOptions) {
  testOptions = testOptions || {};
  testOptions.participantV3s = [];

  function RemoteParticipantV3(initialState, getPendingTrackReceiver, getInitialTrackSwitchOffState, setPriority) {
    EventEmitter.call(this);
    this.revision = initialState.revision || 0;
    this.tracks = (initialState.tracks || []).reduce((tracks, track) => tracks.set(track.sid, track), new Map());
    this.state = initialState.state || 'connected';
    this.sid = initialState.sid;
    this.updateSubscriberTrackPriority = (trackSid, priority) => setPriority(trackSid, priority);
    this.disconnect = sinon.spy(() => {
      this.state = 'disconnected';
      this.emit('stateChanged', this.state);
    });
    this.update = sinon.spy(() => {});
    this.setNetworkQualityLevel = sinon.spy();
    testOptions.participantV3s.push(this);
  }

  inherits(RemoteParticipantV3, EventEmitter);

  return RemoteParticipantV3;
}

function makeRoomV3(options) {
  return new RoomV3(options.localParticipant, options, options.transport, options.peerConnectionManager, options);
}

function makeTransport() {
  const transport = new EventEmitter();
  transport.disconnect = sinon.spy(() => {});
  transport.publish = sinon.spy(() => {});
  transport.publishEvent = sinon.spy(() => {});

  transport.sync = sinon.spy(() => {
    transport.state = 'syncing';
    transport.emit('stateChanged', 'syncing');
  });

  transport.synced = sinon.spy(() => {
    transport.state = 'connected';
    transport.emit('stateChanged', 'connected');
  });

  transport.state = 'connected';
  return transport;
}

function makePeerConnectionManager(getRoom) {
  const peerConnectionManager = new EventEmitter();
  peerConnectionManager.close = sinon.spy(() => {});
  peerConnectionManager.dequeue = sinon.spy(() => {});
  peerConnectionManager.setTrackSenders = sinon.spy(() => {});
  peerConnectionManager.getTrackReceivers = sinon.spy(() => []);
  peerConnectionManager.setIceReconnectTimeout = sinon.spy(() => {});
  peerConnectionManager.setEffectiveAdaptiveSimulcast = sinon.spy(() => {});

  // eslint-disable-next-line require-await
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
    // eslint-disable-next-line no-console
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

    return new Map([
      ['foo', {
        activeIceCandidatePair: {
          includesRelayProtocol: true,
          relayProtocol: 'udp'
        },
        localAudioTrackStats,
        localVideoTrackStats,
        remoteAudioTrackStats,
        remoteVideoTrackStats
      }],
      ['bar', {
        activeIceCandidatePair: { includesRelayProtocol: false },
        localAudioTrackStats,
        localVideoTrackStats,
        remoteAudioTrackStats,
        remoteVideoTrackStats
      }]
    ]);
  };

  peerConnectionManager.update = sinon.spy(() => {});
  return peerConnectionManager;
}

function RoomStateBuilder(room) {
  this.name = room.name;
  this.sid = room.sid;
  this.participants = [];
  // eslint-disable-next-line camelcase
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
  const localParticipant = new EventEmitter();
  localParticipant.sid = makeSid();
  localParticipant.identity = makeIdentity();
  localParticipant.revision = 0;
  localParticipant.getState = sinon.spy(() => ({ revision: localParticipant.revision }));

  localParticipant.connect = sinon.spy(() => localParticipant.emit('stateChanged', 'connected'));
  localParticipant.reconnecting = sinon.spy(() => localParticipant.emit('stateChanged', 'reconnecting'));
  localParticipant.update = sinon.spy(localParticipantState => {
    localParticipantState.tracks.forEach(localTrackState => {
      const localTrackV2 = [...localParticipant.tracks.values()].find(track => track.id === localTrackState.id);
      if (localTrackV2) {
        localTrackV2.sid = localTrackState.sid;
      }
    });
  });

  localParticipant.setBandwidthProfile = sinon.spy();
  localParticipant.setNetworkQualityLevel = sinon.spy();

  localParticipant.incrementRevision = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.localTracks.reduce((tracks, track) => tracks.set(track.id, track), new Map());
  localParticipant.disconnect = sinon.spy(() => {});
  return localParticipant;
}

function makeRemoteTrack(options) {
  return new RemoteTrackPublicationV3(options);
}

function makeTrack(options) {
  const track = new EventEmitter();
  options = options || {};
  track.id = options.id || makeId();
  track.sid = options.sid || null;
  track.trackTransceiver = {};
  track.setTrackTransceiver = sinon.spy(() => {});
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

function makeTrackReceiver(mediaStreamTrack, mid = null) {
  var trackReceiver = new EventEmitter();
  const { id, kind } = mediaStreamTrack;
  trackReceiver.id = id;
  trackReceiver.kind = kind;
  trackReceiver.mid = mid;
  trackReceiver.readyState = 'foo';
  trackReceiver.track = mediaStreamTrack;
  return trackReceiver;
}
