/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const defaults = require('../../lib/defaults');
const { isFirefox } = require('../../lib/guessbrowser');
const { completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  participantsConnected,
  setupAliceAndBob,
  smallVideoConstraints,
  tracksSubscribed,
  validateMediaFlow,
  waitFor,
  waitForEvent,
  waitForSometime
} = require('../../lib/util');

const createLocalTracks = require('../../../lib/createlocaltrack');
const connect = require('../../../lib/connect');

async function assertMediaFlow(room, mediaFlowExpected,  errorMessage) {
  let mediaFlowDetected = false;
  try {
    await validateMediaFlow(room, 2000);
    mediaFlowDetected = true;
  } catch (err) {
    mediaFlowDetected = false;
  }
  errorMessage = errorMessage || `Unexpected mediaFlow ${mediaFlowDetected} in ${room.sid}`;
  assert.equal(mediaFlowDetected, mediaFlowExpected, errorMessage);
}

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

  describe(`${description}._setMediaStreamTrack`, function() {
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

    it('media flows after track is replaced, ', async () => {
      await assertMediaFlow(aliceRoom, false, `Unexpected media flow before publishing track: ${aliceRoom.sid}`);
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));

      // Bob publishes track
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);
      await waitForSometime(5000);

      await assertMediaFlow(aliceRoom, true, `Unexpected media flow after publishing track: ${aliceRoom.sid}`);

      // stop track and its clones.
      bobLocalTrackA._trackSender.track.stop();
      bobLocalTrackA._trackSender._clones.forEach(clone => clone.track.stop());

      // on firefox, media stats show few bytes even after track is stopped.
      if (!isFirefox) {
        await waitForSometime(1000);
        await assertMediaFlow(aliceRoom, false, `Unexpected media flow after stopping track: ${aliceRoom.sid}`);
      }

      const startedPromise = waitForEvent(bobLocalTrackA, 'started');

      const bobLocalTrackB = await createLocalTrack(Object.assign({ name: 'trackB' }, options));
      bobLocalTrackA._setMediaStreamTrack(bobLocalTrackB.mediaStreamTrack);

      // started event should fire on the track.
      await startedPromise;

      await waitForSometime(1000);
      await assertMediaFlow(aliceRoom, true, `Unexpected media flow after replacing track: ${aliceRoom.sid}`);

      // Stop Bob's LocalTracks.
      [bobLocalTrackA, bobLocalTrackB].forEach(track => track.stop());
    });

    it('track can be disabled after publishing (@unstable: JSDK-2852)', async () => {
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
      await waitForEvent(bobRemoteTrack.track, 'disabled');

      assert.equal(bobRemoteTrack.track.isEnabled, false, `alice was expecting remoteTrack to be 'disabled' in ${roomSid}`);

      // Stop Bob's LocalTrack.
      bobLocalTrackA.stop();
    });

    [true, false].forEach(trackEnabled => {
      it(`media track replacement preserves isEnabled state: ${trackEnabled} (@unstable: JSDK-2852)`, async () => {
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

        // bob replaces the track.
        const bobLocalTrackB = await createLocalTrack(Object.assign({ name: 'trackB' }, options));
        bobLocalTrackA._setMediaStreamTrack(bobLocalTrackB.mediaStreamTrack);

        // Charlie joins a room after sometime.
        const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

        await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

        // wait for Charlie to see Bob's track
        const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
        await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`);

        const bobRemoteTrackForCharlie = [...bobRemoteInCharlieRoom[`${kind}Tracks`].values()][0];
        assert.equal(bobRemoteTrackForCharlie.track.isEnabled, trackEnabled, `Charlie was expecting remoteTrack to be ${trackEnabled ? 'enabled' : 'disabled'} in ${roomSid}`);

        // Stop Bob's LocalTracks.
        [bobLocalTrackA, bobLocalTrackB].forEach(track => track.stop());
      });
    });

    it('track can be replaced again and again', async () => {
      // Bob publishes track
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);

      // bob replaces the track.
      const bobLocalTrackB = await createLocalTrack(Object.assign({ name: 'trackB' }, options));
      bobLocalTrackA._setMediaStreamTrack(bobLocalTrackB.mediaStreamTrack);

      await waitForEvent(bobLocalTrackA, 'started');

      // bob replaces the track again.
      const bobLocalTrackC = await createLocalTrack(Object.assign({ name: 'trackC' }, options));
      bobLocalTrackA._setMediaStreamTrack(bobLocalTrackC.mediaStreamTrack);

      // started event should fire on the track.
      await waitForEvent(bobLocalTrackA, 'started');
      await waitForSometime(1000);
      await assertMediaFlow(aliceRoom, true, `Unexpected media flow after replacing track: ${aliceRoom.sid}`);

      // Stop Bob's LocalTracks.
      [bobLocalTrackA, bobLocalTrackB, bobLocalTrackC].forEach(track => track.stop());
    });

    // NOTE: replaceTrack causes the mediaStream track to get replaced. it does not require re-negotiation for existing PeerConnections.
    //  but for new PCs (applicable to new participants on P2P) is the offer/answer would have id for new mediaStream which does not
    //  match the id sent in signaling messages. This test ensures that we take care of this case.
    it('new participant can subscribe to track after it has been replaced', async () => {
      const bobLocalTrackA = await createLocalTrack(Object.assign({ name: 'trackA' }, options));

      // Bob publishes track
      await waitFor(bobLocal.publishTrack(bobLocalTrackA), `Bob to publish trackA: ${roomSid}`);

      // wait for alice to see bobs track
      const bobRemoteInAliceRoom = aliceRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemoteInAliceRoom, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

      // stop track and its clones.
      bobLocalTrackA._trackSender.track.stop();
      bobLocalTrackA._trackSender._clones.forEach(clone => clone.track.stop());

      // bob replaces track
      const bobLocalTrackB = await createLocalTrack(Object.assign({ name: 'trackB' }, options));
      console.log(`bob replaces the track: mediaStreamTrack track old: ${bobLocalTrackA.mediaStreamTrack.id}, new: ${bobLocalTrackB.mediaStreamTrack.id}`);
      bobLocalTrackA._setMediaStreamTrack(bobLocalTrackB.mediaStreamTrack);

      // Charlie joins a room after sometime.
      await waitForSometime(5000);
      const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

      // wait for Charlie to see Bob an Alice
      await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

      const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

      await waitForSometime(5000);
      await assertMediaFlow(charlieRoom, true, `Unexpected media flow after replacing track: ${charlieRoom.sid}`);

      // Stop Bob's LocalTracks.
      [bobLocalTrackA, bobLocalTrackB].forEach(track => track.stop());
    });
  });
});
