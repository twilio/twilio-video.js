/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { trackPriority } = require('../../../lib/util/constants');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');

const defaults = require('../../lib/defaults');
const { completeRoom } = require('../../lib/rest');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const {
  createSyntheticAudioStreamTrack,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn
} = require('../../lib/util');


describe('bandwidth profile', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('RemoteTrack.setPriority', () => {
    let thisRoom; let thoseRooms;
    let aliceLocal; let bobLocal;
    let aliceRemote; let bobRemote;
    let aliceTracks; let bobTracks;
    let aliceRemoteVideoTrack; let bobRemoteVideoTrack;

    beforeEach(async () => {
      [, thisRoom, thoseRooms] = await setup({
        testOptions: {
          bandwidthProfile: {
            video: { maxTracks: 1 }
          },
          tracks: []
        },
        otherOptions: { tracks: [] },
        nTracks: 0
      });

      [aliceTracks, bobTracks] = await Promise.all([1, 2].map(async () => [
        createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
        await createLocalVideoTrack(smallVideoConstraints)
      ]));

      [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
      [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

      // Alice publishes her tracks at low priority
      // Bob publishes his tracks at medium priority
      await Promise.all([
        ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
        ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        tracksSubscribed(aliceRemote, 2),
        tracksSubscribed(bobRemote, 2)
      ]);

      [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
        return [...videoTracks.values()][0].track;
      });
    });

    afterEach(async () => {
      [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
      if (thisRoom) {
        await completeRoom(thisRoom.sid);
      }
    });

    [null, ...Object.values(trackPriority)].forEach(priority => {
      it('can set valid priority value: ' + priority, () => {
        assert.equal(aliceRemoteVideoTrack.priority, null);
        aliceRemoteVideoTrack.setPriority(priority);
        assert.equal(aliceRemoteVideoTrack.priority, priority);
      });
    });

    [undefined, 'foo', 42].forEach(priority => {
      it('throws for an invalid priority value: ' + priority, () => {
        let errorWasThrown = false;
        try {
          aliceRemoteVideoTrack.setPriority(priority);
        } catch (error) {
          assert(error instanceof RangeError);
          assert(/priority must be one of/.test(error.message));
          errorWasThrown = true;
        }
        assert.equal(errorWasThrown, true, 'was expectiing an error to be thrown, but it was not');
      });
    });

    if (defaults.topology !== 'peer-to-peer') {
      it('subscriber can update track\'s priority', async () => {
        // initially expect Bob's track to get switched on, and Alice's track to get switched off
        await Promise.all([
          trackSwitchedOn(bobRemoteVideoTrack),
          trackSwitchedOff(aliceRemoteVideoTrack)
        ]);

        // change subscriber priority of the Alice track to high
        aliceRemoteVideoTrack.setPriority(PRIORITY_HIGH);

        // eslint-disable-next-line no-warning-comments
        // TODO: remove this check once VMS changes go to prod
        if (defaults.environment === 'dev') {
          // expect Alice's track to get switched on, and Bob's track to get switched off
          await Promise.all([
            trackSwitchedOn(aliceRemoteVideoTrack),
            trackSwitchedOff(bobRemoteVideoTrack)
          ]);

          // reset subscriber priority of the Alice track
          aliceRemoteVideoTrack.setPriority(null);

          // expect Bob's track to get switched on again, and Alice's track to get switched off
          await Promise.all([
            trackSwitchedOn(bobRemoteVideoTrack),
            trackSwitchedOff(aliceRemoteVideoTrack)
          ]);
        }
      });
    }
  });
});

