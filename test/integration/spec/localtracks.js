/* eslint-disable no-console */
'use strict';

const assert = require('assert');

const createLocalTracks = require('../../../lib/createlocaltrack');
const {
  setupAliceAndBob,
  smallVideoConstraints,
  validateMediaFlow,
  waitFor,
  waitForSometime
} = require('../../lib/util');

const {
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

  describe('replaceTrack behavior', function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(120000); // this may take long.

    let roomSid;
    let aliceRoom;
    let bobRoom;
    let bobLocal;
    beforeEach(async () => {
      ({ roomSid, aliceRoom, bobLocal, bobRoom } = await setupAliceAndBob({
        aliceOptions: { tracks: [] },
        bobOptions: { tracks: [] },
      }));
    });
    afterEach(() => {
      [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
    });

    it('media flow restarts when track is replaced', async () => {
      console.log('Checking media flow before publish');
      await assertMediaFlow(aliceRoom, false, `Unexpected media flow before publishing track: ${aliceRoom.sid}`);
      const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

      // Bob publishes video track
      await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);
      await waitForSometime(5000);

      console.log('Checking media flow after publish');
      await assertMediaFlow(aliceRoom, true, `Unexpected media flow after publishing track: ${aliceRoom.sid}`);

      bobVideoTrackA._trackSender._clones.forEach(clone => clone.track.stop());

      await waitForSometime(1000);
      console.log('Checking media flow after stop');
      await assertMediaFlow(aliceRoom, false, `Unexpected media flow after stopping track: ${aliceRoom.sid}`);

      const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));
      bobVideoTrackA._setMediaStreamTrack(bobVideoTrackB.mediaStreamTrack);
      await waitForSometime(1000);

      console.log('Checking media flow after track replace');
      await assertMediaFlow(aliceRoom, true, `Unexpected media flow after replacing track: ${aliceRoom.sid}`);
    });
  });
});
