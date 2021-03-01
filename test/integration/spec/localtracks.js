/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const defaults = require('../../lib/defaults');
const { completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  participantsConnected,
  setupAliceAndBob,
  smallVideoConstraints,
  tracksSubscribed,
  assertMediaFlow,
  waitFor,
  waitForEvent,
  waitForSometime
} = require('../../lib/util');

const createLocalTracks = require('../../../lib/createlocaltrack');
const connect = require('../../../lib/connect');

['audio', 'video'].forEach(kind => {
  const createLocalTrack = createLocalTracks[kind];
  const description = 'Local' + kind[0].toUpperCase() + kind.slice(1) + 'Track';

  const options = {
    audio: {},
    video: smallVideoConstraints
  }[kind];

  describe(description, function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(10000);

    let localTrack = null;

    beforeEach(() => {
      return createLocalTrack().then(_localTrack => {
        localTrack = _localTrack;
      });
    });

    afterEach(() => {
      localTrack.stop();
      localTrack = null;
    });

    describe('.isStopped', () => {
      context('before calling #stop', () => {
        it('.isStopped is false', () => {
          assert(!localTrack.isStopped);
        });
      });

      context('after calling #stop', () => {
        beforeEach(() => {
          localTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });

      context('when the underlying MediaStreamTrack ends', () => {
        beforeEach(() => {
          localTrack.mediaStreamTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });
    });

    describe('"stopped" event', () => {
      let stoppedEvent = null;

      beforeEach(() => {
        stoppedEvent = new Promise(resolve => {
          localTrack.once('stopped', resolve);
        });
      });

      afterEach(() => {
        stoppedEvent = null;
      });

      context('when #stop is called', () => {
        it('emits "stopped"', () => {
          localTrack.stop();
          return stoppedEvent;
        });
      });
    });
  });

  describe(`${description}#restart`, function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(120000);

    let roomSid;
    let aliceRoom;
    let bobRoom;
    let bobLocal;
    let roomName;
    let charlieRoom;

    beforeEach(async () => {
      aliceRoom = null;
      bobRoom = null;
      charlieRoom = null;
      ({ roomName, roomSid, aliceRoom, bobLocal, bobRoom } = await setupAliceAndBob({
        aliceOptions: { tracks: [] },
        bobOptions: { tracks: [] },
      }));
    });

    afterEach(() => {
      [aliceRoom, bobRoom, charlieRoom].forEach(room => room && room.disconnect());
      return completeRoom(roomSid);
    });

    it('should continue media flow', async () => {
      await assertMediaFlow(aliceRoom, false, `Unexpected media flow before publishing track: ${aliceRoom.sid}`);
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));

      // Bob publishes track
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);
      await waitForSometime(5000);
      await assertMediaFlow(aliceRoom, true, `Unexpected lack of media flow after publishing track: ${aliceRoom.sid}`);

      const startedPromise = waitForEvent(bobLocalTrackA, 'started');
      const stoppedPromise = waitForEvent(bobLocalTrackA, 'stopped');

      // Bob restarts track.
      await bobLocalTrackA.restart();

      // "stopped" and "started" events should fire in order.
      await waitFor(stoppedPromise, `Bob's LocalTrack to stop: ${aliceRoom.sid}`);
      await waitFor(startedPromise, `Bob's LocalTrack to start: ${aliceRoom.sid}`);

      await waitForSometime(1000);
      await assertMediaFlow(aliceRoom, true, `Unexpected lack of media flow after replacing track: ${aliceRoom.sid}`);

      // Stop Bob's LocalTracks.
      bobLocalTrackA.stop();
    });

    it(`${description} can be disabled after publishing (@unstable: JSDK-2852)`, async () => {
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);
      bobLocalTrackA.enable(false);
      assert.equal(bobLocalTrackA.isEnabled, false);

      // wait for Alice to see Bob's track
      const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);

      const bobRemoteTrack = [...bobRemote[`${kind}Tracks`].values()][0];

      // NOTE(mmalavalli): We have to wait for the "disabled" event to fire on Alice's
      // RemoteTrack for Bob before verifying that it was disabled.
      if (bobRemoteTrack.track.isEnabled) {
        await waitForEvent(bobRemoteTrack.track, 'disabled');
      }
      assert.equal(bobRemoteTrack.track.isEnabled, false, `alice was expecting remoteTrack to be 'disabled' in ${roomSid}`);

      // Stop Bob's LocalTrack.
      bobLocalTrackA.stop();
    });

    [true, false].forEach(trackEnabled => {
      it(`should preserve isEnabled state: ${trackEnabled} (@unstable: JSDK-2852)`, async () => {
        // Bob publishes track
        const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));
        await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);

        // wait for Alice to see Bob's track
        const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);
        await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);

        const bobRemoteTrack = [...bobRemote[`${kind}Tracks`].values()][0];

        if (bobLocalTrackA.isEnabled !== trackEnabled) {
          bobLocalTrackA.enable(trackEnabled);
          assert.equal(bobLocalTrackA.isEnabled, trackEnabled);

          // wait for alice to see track change.
          const expectEvent = trackEnabled ? 'enabled' : 'disabled';
          const trackEventPromise = waitForEvent(bobRemoteTrack.track, expectEvent);
          await waitFor(trackEventPromise, `waiting for alice to see track ${expectEvent} on Bob's track: ${roomSid}`);
        }
        assert.equal(bobRemoteTrack.track.isEnabled, trackEnabled, `alice was expecting remoteTrack to be ${trackEnabled ? 'enabled' : 'disabled'} in ${roomSid}`);

        const startedPromise = waitForEvent(bobLocalTrackA, 'started');
        const stoppedPromise = waitForEvent(bobLocalTrackA, 'stopped');

        // Bob restarts track.
        await bobLocalTrackA.restart();

        // "stopped" and "started" events should fire in order.
        await waitFor(stoppedPromise, `Bob's LocalTrack to stop: ${roomSid}`);
        await waitFor(startedPromise, `Bob's LocalTrack to start: ${roomSid}`);

        // Charlie joins a room after sometime.
        const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

        await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

        // wait for Charlie to see Bob's track
        const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
        await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`);

        const bobRemoteTrackForCharlie = [...bobRemoteInCharlieRoom[`${kind}Tracks`].values()][0];
        assert.equal(bobRemoteTrackForCharlie.track.isEnabled, trackEnabled, `Charlie was expecting remoteTrack to be ${trackEnabled ? 'enabled' : 'disabled'} in ${roomSid}`);

        // Stop Bob's LocalTracks.
        bobLocalTrackA.stop();
      });
    });

    it('should be able to restart more than once', async () => {
      // Bob publishes track
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);

      const startedPromise1 = waitForEvent(bobLocalTrackA, 'started');
      const stoppedPromise1 = waitForEvent(bobLocalTrackA, 'stopped');

      // Bob restarts the track.
      await bobLocalTrackA.restart();

      // "stopped" and "started" events should fire in order.
      await waitFor(stoppedPromise1, `Bob's LocalTrack to stop (1): ${aliceRoom.sid}`);
      await waitFor(startedPromise1, `Bob's LocalTrack to start (1): ${aliceRoom.sid}`);

      const startedPromise2 = waitForEvent(bobLocalTrackA, 'started');
      const stoppedPromise2 = waitForEvent(bobLocalTrackA, 'stopped');

      // Bob restarts the track again.
      await bobLocalTrackA.restart();

      // "stopped" and "started" events should fire in order.
      await waitFor(stoppedPromise2, `Bob's LocalTrack to stop (2): ${aliceRoom.sid}`);
      await waitFor(startedPromise2, `Bob's LocalTrack to start (2): ${aliceRoom.sid}`);

      await waitForSometime(1000);
      await assertMediaFlow(aliceRoom, true, `Unexpected lack of media flow after replacing track: ${aliceRoom.sid}`);

      // Stop Bob's LocalTrack.
      bobLocalTrackA.stop();
    });

    // NOTE(mpatwardhan): restart() causes the MediaStreamTrack to get replaced. it does not require re-negotiation for existing PeerConnections.
    //  but for new PCs (applicable to new participants on P2P) is the offer/answer would have new MSIDs which do not
    //  match the those sent in signaling messages. This test ensures that we take care of this case.
    it('should be able to be subscribed to by RemoteParticipants that join the Room after restart', async () => {
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));

      // Bob publishes track
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);

      // wait for alice to see bobs track
      const bobRemoteInAliceRoom = aliceRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemoteInAliceRoom, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

      // Bob restarts the track.
      await bobLocalTrackA.restart();
      console.log(`bob replaces the track: mediaStreamTrack track old: ${bobLocalTrackA.id}, new: ${bobLocalTrackA.mediaStreamTrack.id}`);

      // Charlie joins a room after sometime.
      await waitForSometime(5000);
      const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

      // wait for Charlie to see Bob an Alice
      await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

      const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

      await waitForSometime(5000);
      await assertMediaFlow(charlieRoom, true, `Unexpected lack of media flow after replacing track: ${charlieRoom.sid}`);

      // Stop Bob's LocalTrack.
      bobLocalTrackA.stop();
    });
  });
});
