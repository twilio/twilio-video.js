'use strict';

const assert = require('assert');
const { EventEmitter }  = require('events');
const { inherits } = require('util');
const sinon = require('sinon');

const { flatMap } = require('../../../../../lib/util');

const StatsReport = require('../../../../../lib/stats/statsreport');
const RoomV2 = require('../../../../../lib/signaling/v2/room');

describe('RoomV2', () => {
  // RoomV2
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
        }),
        foo: new StatsReport('foo', {
          localAudioTrackStats: [{ trackId: '1', trackSid: 'MT1' }],
          localVideoTrackStats: [{ trackId: '2', trackSid: 'MT2' }],
          remoteAudioTrackStats: [],
          remoteVideoTrackStats: []
        })
      };

      const expectedArgs = [
        [
          'quality',
          'stats-report',
          {
            participantSid: test.localParticipant.sid,
            peerConnectionId: 'foo',
            roomSid: test.sid,
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
            baz: 'zee'
          }
        ],
        [
          'quality',
          'stats-report',
          {
            participantSid: test.localParticipant.sid,
            peerConnectionId: 'bar',
            roomSid: test.sid,
            audioTrackStats: reports.bar.remoteAudioTrackStats,
            localAudioTrackStats: reports.bar.localAudioTrackStats,
            localVideoTrackStats: reports.bar.localVideoTrackStats,
            videoTrackStats: reports.bar.remoteVideoTrackStats
          }
        ],
        [
          'quality',
          'active-ice-candidate-pair',
          {
            peerConnectionId: 'bar',
            zee: 'foo'
          }
        ]
      ];
      await wait(175);
      test.transport.publishEvent.args.slice(0, 4).forEach(([, name, payload], i) => {
        if (name === 'stats-report') {
          assert.deepEqual(payload, expectedArgs[i][2]);
          return;
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
      it('constructs a new ParticipantV2 for each Participant state', () => {
        const sid1 = makeParticipantSid();
        const sid2 = makeParticipantSid();
        const test = makeTest({
          participants: [
            { sid: sid1, tracks: [] },
            { sid: sid2, tracks: [] }
          ]
        });
        assert.equal(sid1, test.participantV2s[0].sid);
        assert.equal(sid2, test.participantV2s[1].sid);
      });

      it('adds the newly-constructed ParticipantV2s to the RoomV2\'s .participants Map', () => {
        const sid1 = makeParticipantSid();
        const sid2 = makeParticipantSid();
        const test = makeTest({
          participants: [
            { sid: sid1, tracks: [] },
            { sid: sid2, tracks: [] }
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
          test.participantV2s[0].update.args[0][0]);
        assert.deepEqual(
          { sid: sid2, baz: 'qux', tracks: [] },
          test.participantV2s[1].update.args[0][0]);
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

      context('before the getTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
        it('calling getTrackTransceiver resolves to the MediaTrackSender', async () => {
          const id = makeId();
          const mediaStreamTrack = { id: id, kind: 'foo' };
          const trackReceiver = makeTrackReceiver(mediaStreamTrack);
          const peerConnectionManager = makePeerConnectionManager([], []);
          peerConnectionManager.getTrackReceivers = () => [trackReceiver];

          const test = makeTest({
            participants: [
              { sid: makeSid(), tracks: [] }
            ],
            peerConnectionManager: peerConnectionManager
          });

          const trackTransceiver = await test.participantV2s[0].getTrackTransceiver(id);
          assert.equal(mediaStreamTrack, trackTransceiver.track);
        });
      });
    });
  });

  // RoomSignaling
  // -------------

  describe('#connectParticipant, called when the ParticipantV2 was', () => {
    context('previously connected', () => {
      it('returns false', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        assert.equal(
          false,
          test.room.connectParticipant(test.participantV2s[0]));
      });

      it('the ParticipantV2 remains in the RoomV2\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.connectParticipant(test.participantV2s[0]);
        assert.equal(
          test.participantV2s[0],
          test.room.participants.get(test.participantV2s[0].sid));
      });

      it('does not emit the "participantConnected" event', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        let participantConnected = false;
        test.room.once('participantConnected', () => { participantConnected = true; });
        test.room.connectParticipant(test.participantV2s[0]);
        assert(!participantConnected);
      });
    });

    context('not previously connected', () => {
      it('returns true', () => {
        const RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        const participant = new RemoteParticipantV2({ sid: makeSid() });
        const test = makeTest();
        assert.equal(
          true,
          test.room.connectParticipant(participant));
      });

      it('adds the ParticipantV2 to the RoomV2\'s .participants Map', () => {
        const RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        const participant = new RemoteParticipantV2({ sid: makeSid() });
        const test = makeTest();
        test.room.connectParticipant(participant);
        assert.equal(
          participant,
          test.room.participants.get(participant.sid));
      });

      it('emits the "participantConnected" event with the ParticipantV2', () => {
        const RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
        const participant = new RemoteParticipantV2({ sid: makeSid() });
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
          activeIceCandidatePair: { baz: 'zee' },
          localAudioTrackStats,
          localVideoTrackStats,
          remoteAudioTrackStats,
          remoteVideoTrackStats
        },
        {
          activeIceCandidatePair: { zee: 'foo' },
          localAudioTrackStats,
          localVideoTrackStats,
          remoteAudioTrackStats,
          remoteVideoTrackStats
        }
      ]);
    });
  });

  describe('#disconnect, called when the RoomV2 .state is', () => {
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

      it('does not call .disconnect on any connected ParticipantV2\'s', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV2\'s from the RoomV2\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
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

      it('does not call .disconnect on any connected ParticipantV2\'s', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.room.disconnect();
        test.room.disconnect();
        test.participantV2s.forEach(participant => {
          assert(!participant.disconnect.calledOnce);
        });
      });

      it('does not remove any ParticipantV2\'s from the RoomV2\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] },
            { sid: makeSid(), tracks: [] }
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
    context('when a connected ParticipantV2 emits a "stateChanged" event with a new state "disconnected"', () => {
      it('removes the ParticipantV2 from the RoomV2\'s .participants Map', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        test.participantV2s[0].emit('stateChanged', 'disconnected');
        assert(!test.room.participants.has(test.participantV2s[0].sid));
      });

      it('emits the "participantDisconnected" event with the ParticipantV2', () => {
        const test = makeTest({
          participants: [
            { sid: makeSid(), tracks: [] }
          ]
        });
        let participantDisconnected;
        test.room.once('participantDisconnected', participant => { participantDisconnected = participant; });
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

    context('when the PeerConnectionManager emits a "trackAdded" event for a MediaStreamTrack with an ID that has', () => {
      context('never been used before', () => {
        context('before the getTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getTrackTransceiver resolves to the MediaTrackSender', async () => {
            const test = makeTest({
              participants: [
                { sid: makeSid(), tracks: [] }
              ]
            });
            const id = makeId();
            const mediaStreamTrack = { id: id, kind: 'foo' };
            const trackReceiver = makeTrackReceiver(mediaStreamTrack);
            test.peerConnectionManager.emit('trackAdded', trackReceiver);
            const trackTransceiver = await test.participantV2s[0].getTrackTransceiver(id);
            assert.equal(mediaStreamTrack, trackTransceiver.track);
          });
        });

        context('after the getTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getTrackTransceiver resolves to the MediaTrackSender', async () => {
            const test = makeTest({
              participants: [
                { sid: makeSid(), tracks: [] }
              ]
            });
            const id = makeId();
            const mediaStreamTrack = { id: id, kind: 'foo' };
            const trackReceiver = makeTrackReceiver(mediaStreamTrack);
            const promise = test.participantV2s[0].getTrackTransceiver(id);
            test.peerConnectionManager.emit('trackAdded', trackReceiver);
            const trackTransceiver = await promise;
            assert.equal(mediaStreamTrack, trackTransceiver.track);
          });
        });
      });

      context('been used before', () => {
        context('before the getTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getTrackTransceiver resolves to the MediaTrackSender', async () => {
            const test = makeTest({
              participants: [
                { sid: makeSid(), tracks: [] }
              ]
            });

            const id = makeId();
            const mediaStreamTrack1 = { id: id, kind: 'audio' };
            const mediaStreamTrack2 = { id: id, kind: 'video' };
            const trackReceiver1 = makeTrackReceiver(mediaStreamTrack1);
            const trackReceiver2 = makeTrackReceiver(mediaStreamTrack2);

            // First usage
            test.peerConnectionManager.emit('trackAdded', trackReceiver1);
            await test.participantV2s[0].getTrackTransceiver(id);

            // Second usage
            test.peerConnectionManager.emit('trackAdded', trackReceiver2);
            const trackTransceiver2 = await test.participantV2s[0].getTrackTransceiver(id);
            assert.equal(mediaStreamTrack2, trackTransceiver2.track);
          });
        });

        context('after the getTrackTransceiver function passed to RemoteParticipantV2\'s is called with the MediaStreamTrack\'s ID', () => {
          it('calling getTrackTransceiver resolves to the MediaTrackSender', async () => {
            const test = makeTest({
              participants: [
                { sid: makeSid(), tracks: [] }
              ]
            });

            const id = makeId();
            const mediaStreamTrack1 = { id: id, kind: 'audio' };
            const mediaStreamTrack2 = { id: id, kind: 'video' };
            const trackReceiver1 = makeTrackReceiver(mediaStreamTrack1);
            const trackReceiver2 = makeTrackReceiver(mediaStreamTrack2);

            // First usage
            let promise = test.participantV2s[0].getTrackTransceiver(id);
            test.peerConnectionManager.emit('trackAdded', trackReceiver1);
            await promise;

            // Second usage
            promise = test.participantV2s[0].getTrackTransceiver(id);
            test.peerConnectionManager.emit('trackAdded', trackReceiver2);
            const trackTransceiver2 = await promise;
            assert.equal(mediaStreamTrack2, trackTransceiver2.track);
          });
        });
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
          it('constructs a new ParticipantV2 with the Participant state', () => {
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
              test.participantV2s[0].sid);
          });

          it('adds the newly-constructed ParticipantV2 to the RoomV2\'s .participants Map', () => {
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
              test.participantV2s[0],
              test.room.participants.get(sid));
          });

          it('emits the "participantConnected" event with the newly-constructed ParticipantV2', () => {
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
              test.participantV2s[0],
              participantConnected);
          });

          it('calls .update with the Participant state on the newly-constructed ParticipantV2', () => {
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
              test.participantV2s[0].update.args[0][0]);
          });
        });

        context('and the Participant state\'s .state is "disconnected"', () => {
          it('constructs a new ParticipantV2 with the Participant state', () => {
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
              test.participantV2s[0].sid);
          });

          it('does not add the newly-constructed ParticipantV2 to the RoomV2\'s .participants Map', () => {
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

      context('when .participants includes a Participant state for a connected ParticipantV2', () => {
        it('calls .update with the Participant state on the ParticipantV2', () => {
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
            test.participantV2s[0].update.args[1][0]);
        });
      });

      context('when .participants includes a Participant state for a disconnected ParticipantV2', () => {
        it('does not construct a new ParticipantV2 with the Participant state', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.participantV2s[0].emit('stateChanged', 'disconnected');
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz', tracks: [] }
            ],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert.equal(
            1,
            test.participantV2s.length);
        });

        it('does not call .update with the Participant state on the disconnected ParticipantV2', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.participantV2s[0].emit('stateChanged', 'disconnected');
          test.transport.emit('message', {
            participants: [
              { sid: sid, fizz: 'buzz', tracks: [] }
            ],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert(!test.participantV2s[0].update.calledTwice);
        });
      });

      context('when .participants omits a Participant state for a connected ParticipantV2', () => {
        it('does not call .disconnect on the ParticipantV2', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.transport.emit('message', {
            participants: [],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert(!test.participantV2s[0].disconnect.calledOnce);
        });

        it('the ParticipantV2 remains in the RoomV2\'s .participants Map', () => {
          const sid = makeParticipantSid();
          const test = makeTest({
            participants: [
              { sid: sid, tracks: [] }
            ]
          });
          test.transport.emit('message', {
            participants: [],
            // eslint-disable-next-line camelcase
            peer_connections: []
          });
          assert.equal(
            test.participantV2s[0],
            test.room.participants.get(sid));
        });

        it('does not emit a "participantDisconnected" event', () => {
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
            peer_connections: []
          });
          assert(!participantDisconnected);
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

    context('.subscribed', () => {
    });
  });

  // Network Quality Signaling
  // -------------------------

  describe('Network Quality Signaling', () => {
    describe('when update is called with an RSP message that negotiates Network Quality Signaling over RTCDataChannel', () => {
      let networkQualitySignaling;
      let NetworkQualitySignaling;

      let networkQualityMonitor;
      let NetworkQualityMonitor;

      let test;

      beforeEach(() => {
        NetworkQualitySignaling = sinon.spy(function() {
          networkQualitySignaling = {};
          return networkQualitySignaling;
        });

        NetworkQualityMonitor = sinon.spy(function() {
          networkQualityMonitor = new EventEmitter();
          networkQualityMonitor.start = sinon.spy();
          networkQualityMonitor.stop = sinon.spy();
          return networkQualityMonitor;
        });

        test = makeTest({
          NetworkQualitySignaling,
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

        it('constructs a NetworkQualitySignaling with the DataTrackTransport,', () => {
          assert(NetworkQualitySignaling.calledWith(dataTrackTransport));
        });

        it('constructs a NetworkQualityMonitor with the NetworkQualitySignaling,', () => {
          assert(NetworkQualityMonitor.calledWith(test.peerConnectionManager, networkQualitySignaling));
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
          const RemoteParticipantV2 = makeRemoteParticipantV2Constructor();
          const participant = new RemoteParticipantV2({ sid: makeSid() });
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

        describe('then, when the RoomV2 finally disconnects,', () => {
          it('calls .stop() on the NetworkQualityMonitor', () => {
            test.room.disconnect();
            assert(networkQualityMonitor.stop.calledOnce);
          });
        });
      });

      describe('if the RoomV2 is disconnected before it gets the DataTrackReceiver', () => {
        let NetworkQualitySignaling;

        let test;

        beforeEach(() => {
          NetworkQualitySignaling = sinon.spy(function() {});

          test = makeTest({
            NetworkQualitySignaling
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

          assert(NetworkQualitySignaling.notCalled);
        });
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

  function RemoteParticipantV2(initialState, getTrackTransceiver) {
    EventEmitter.call(this);
    this.tracks = (initialState.tracks || []).reduce((tracks, track) => tracks.set(track.sid, track), new Map());
    this.state = initialState.state || 'connected';
    this.sid = initialState.sid;
    this.getTrackTransceiver = getTrackTransceiver;
    this.disconnect = sinon.spy(() => {
      this.state = 'disconnected';
      this.emit('stateChanged', this.state);
    });
    this.update = sinon.spy(() => {});
    this.setNetworkQualityLevel = sinon.spy();
    testOptions.participantV2s.push(this);
  }

  inherits(RemoteParticipantV2, EventEmitter);

  return RemoteParticipantV2;
}

function makeRoomV2(options) {
  return new RoomV2(options.localParticipant, options, options.transport, options.peerConnectionManager, options);
}

function makeTransport() {
  const transport = new EventEmitter();
  transport.disconnect = sinon.spy(() => {});
  transport.publish = sinon.spy(() => {});
  transport.publishEvent = sinon.spy(() => {});
  transport.sync = sinon.spy(() => {});
  return transport;
}

function makePeerConnectionManager(getRoom) {
  const peerConnectionManager = new EventEmitter();
  peerConnectionManager.close = sinon.spy(() => {});
  peerConnectionManager.dequeue = sinon.spy(() => {});
  peerConnectionManager.setTrackSenders = sinon.spy(() => {});
  peerConnectionManager.getTrackReceivers = sinon.spy(() => []);

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

    return new Map([
      ['foo', {
        activeIceCandidatePair: { baz: 'zee' },
        localAudioTrackStats,
        localVideoTrackStats,
        remoteAudioTrackStats,
        remoteVideoTrackStats
      }],
      ['bar', {
        activeIceCandidatePair: { zee: 'foo' },
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

  localParticipant.connect = () => {};
  localParticipant.update = sinon.spy(localParticipantState => {
    localParticipantState.tracks.forEach(localTrackState => {
      const localTrackV2 = [...localParticipant.tracks.values()].find(track => track.id === localTrackState.id);
      if (localTrackV2) {
        localTrackV2.sid = localTrackState.sid;
      }
    });
  });

  localParticipant.setNetworkQualityLevel = sinon.spy();

  localParticipant.incrementRevision = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.localTracks.reduce((tracks, track) => tracks.set(track.id, track), new Map());
  localParticipant.disconnect = sinon.spy(() => {});
  return localParticipant;
}

function makeTrack(options) {
  const track = new EventEmitter();
  options = options || {};
  track.id = options.id || makeId();
  track.sid = null;
  track.trackTransceiver = {};
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

function makeTrackReceiver(mediaStreamTrack) {
  const { id, kind } = mediaStreamTrack;
  return {
    id,
    kind,
    readyState: 'foo',
    track: mediaStreamTrack
  };
}
