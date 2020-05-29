/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const { isFirefox } = require('../../lib/guessbrowser');

const createLocalTracks = require('../../../lib/createlocaltrack');
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

const {
  connect,
  createLocalVideoTrack,
} = require('../../../lib');


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

});

describe('replaceTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120000); // this may take long.

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
  });

  it('media flows after track is replaced, ', async () => {
    await assertMediaFlow(aliceRoom, false, `Unexpected media flow before publishing track: ${aliceRoom.sid}`);
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

    // Bob publishes video track
    await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);
    await waitForSometime(5000);

    await assertMediaFlow(aliceRoom, true, `Unexpected media flow after publishing track: ${aliceRoom.sid}`);

    // stop track and its clones.
    bobVideoTrackA._trackSender.track.stop();
    bobVideoTrackA._trackSender._clones.forEach(clone => clone.track.stop());

    // on firefox, media stats show few bytes even after track is stopped.
    if (!isFirefox) {
      await waitForSometime(1000);
      await assertMediaFlow(aliceRoom, false, `Unexpected media flow after stopping track: ${aliceRoom.sid}`);
    }

    const startedPromise = waitForEvent(bobVideoTrackA, 'started');

    const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));
    bobVideoTrackA._setMediaStreamTrack(bobVideoTrackB.mediaStreamTrack);

    // started event should fire on the track.
    await startedPromise;

    await waitForSometime(1000);
    await assertMediaFlow(aliceRoom, true, `Unexpected media flow after replacing track: ${aliceRoom.sid}`);
  });

  it('track can be disabled after publishing (@unstable: JSDK-2852)', async () => {
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);
    bobVideoTrackA.enable(false);
    assert.equal(bobVideoTrackA.isEnabled, false);

    // wait for Alice to see Bob's track
    const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);
    await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);

    const bobRemoteTrack = [...bobRemote.videoTracks.values()][0];
    assert.equal(bobRemoteTrack.track.isEnabled, false, `alice was expecting remoteTrack to be 'disabled' in ${roomSid}`);
  });

  [true, false].forEach(trackEnabled => {
    it(`media track replacement preserves isEnabled state: ${trackEnabled} (@unstable: JSDK-2852)`, async () => {
      // Bob publishes video track
      const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
      await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);

      // wait for Alice to see Bob's track
      const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);

      const bobRemoteTrack = [...bobRemote.videoTracks.values()][0];

      if (bobVideoTrackA.isEnabled !== trackEnabled) {
        bobVideoTrackA.enable(trackEnabled);
        assert.equal(bobVideoTrackA.isEnabled, trackEnabled);

        // wait for alice to see track change.
        const expectEvent = trackEnabled ? 'enabled' : 'disabled';
        const trackEnablePromise = await new Promise(resolve => bobRemoteTrack.once(expectEvent, resolve));
        waitFor(trackEnablePromise, `waiting for alice to see track ${expectEvent} on Bob's track: ${roomSid}`);
      }

      assert.equal(bobRemoteTrack.track.isEnabled, trackEnabled, `alice was expecting remoteTrack to be ${trackEnabled ? 'enabled' : 'disabled'} in ${roomSid}`);

      // bob replaces the track.
      const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));
      bobVideoTrackA._setMediaStreamTrack(bobVideoTrackB.mediaStreamTrack);

      // Charlie joins a room after sometime.
      const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

      await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

      // wait for Charlie to see Bob's track
      const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`);

      const bobRemoteTrackForCharlie = [...bobRemoteInCharlieRoom.videoTracks.values()][0];
      assert.equal(bobRemoteTrackForCharlie.track.isEnabled, trackEnabled, `Charlie was expecting remoteTrack to be ${trackEnabled ? 'enabled' : 'disabled'} in ${roomSid}`);
    });
  });

  it('track can be replaced again and again', async () => {
    // Bob publishes video track
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);

    // bob replaces the track.
    const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));
    bobVideoTrackA._setMediaStreamTrack(bobVideoTrackB.mediaStreamTrack);

    const startedPromise = waitForEvent(bobVideoTrackA, 'started');

    // bob replaces the track again.
    const bobVideoTrackC = await createLocalVideoTrack(Object.assign({ name: 'trackC' }, smallVideoConstraints));
    bobVideoTrackA._setMediaStreamTrack(bobVideoTrackC.mediaStreamTrack);

    // started event should fire on the track.
    await startedPromise;
    await waitForSometime(1000);
    await assertMediaFlow(aliceRoom, true, `Unexpected media flow after replacing track: ${aliceRoom.sid}`);
  });

  // NOTE: replaceTrack causes the mediaStream track to get replaced. it does not require re-negotiation for existing PeerConnections.
  //  but for new PCs (applicable to new participants on P2P) is the offer/answer would have id for new mediaStream which does not
  //  match the id sent in signaling messages. This test ensures that we take care of this case.
  it('new participant can subscribe to track after it has been replaced', async () => {
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

    // Bob publishes video track
    await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);

    // wait for alice to see bobs track
    const bobRemoteInAliceRoom = aliceRoom.participants.get(bobRoom.localParticipant.sid);
    await waitFor(tracksSubscribed(bobRemoteInAliceRoom, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

    // stop track and its clones.
    bobVideoTrackA._trackSender.track.stop();
    bobVideoTrackA._trackSender._clones.forEach(clone => clone.track.stop());

    // bob replaces track
    const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));
    console.log(`bob replaces the track: mediaStreamTrack track old: ${bobVideoTrackA.mediaStreamTrack.id}, new: ${bobVideoTrackB.mediaStreamTrack.id}`);
    bobVideoTrackA._setMediaStreamTrack(bobVideoTrackB.mediaStreamTrack);

    // Charlie joins a room after sometime.
    await waitForSometime(5000);
    const charlieRoom = await connect(getToken('Charlie'), Object.assign({ tracks: [], name: roomName }, defaults));

    // wait for Charlie to see Bob an Alice
    await waitFor(participantsConnected(charlieRoom, 2), `Charlie to see Alice and Bob connected: ${roomSid}`);

    const bobRemoteInCharlieRoom = charlieRoom.participants.get(bobRoom.localParticipant.sid);
    await waitFor(tracksSubscribed(bobRemoteInCharlieRoom, 1), `wait for charlie to subscribe to Bob's tracks: ${roomSid}`, 20000, true);

    await waitForSometime(5000);
    await assertMediaFlow(charlieRoom, true, `Unexpected media flow after replacing track: ${charlieRoom.sid}`);
  });
});

