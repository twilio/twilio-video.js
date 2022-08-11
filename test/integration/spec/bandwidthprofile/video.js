/* eslint-disable no-console */
/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { Logger, connect, createLocalAudioTrack, createLocalVideoTrack } = require('../../../../es5');
const defaults = require('../../../lib/defaults');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  capitalize,
  combinationContext,
  createSyntheticAudioStreamTrack,
  dominantSpeakerChanged,
  randomName,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor
} = require('../../../lib/util');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../../es5/util/constants');
const { trackSwitchOffMode: { MODE_DISABLED, MODE_DETECTED, MODE_PREDICTED } } = require('../../../../es5/util/constants');

function monitorTrackSwitchOffs(remoteTrack, trackName) {
  console.log(`${trackName} [${remoteTrack.sid}] ${remoteTrack.isSwitchedOff ? 'OFF' : 'ON'}`);
  remoteTrack.on('switchedOff', () => {
    console.log(`${trackName} [${remoteTrack.sid}] OFF!`);
  });
  remoteTrack.on('switchedOn', () => {
    console.log(`${trackName} [${remoteTrack.sid}] ON!`);
  });
}

describe('BandwidthProfile: video', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  // this.retries(2);

  if (defaults.topology === 'peer-to-peer') {
    it('should not run', () => {});
    return;
  }

  describe('bandwidthProfile.video', () => {
    combinationContext([
      [
        [{ maxSubscriptionBitrate: 400, maxSwitchedOnTracks: 0 }, { maxSwitchedOnTracks: 1 }], // maxSwitchedOnTracks=0 specified to disable clientTrackSwitchOffControl.
        ({ maxSubscriptionBitrate, maxSwitchedOnTracks }) => maxSubscriptionBitrate
          ? `.maxSubscriptionBitrate = ${maxSubscriptionBitrate}`
          : `.maxSwitchedOnTracks = ${maxSwitchedOnTracks}`
      ],
      [
        [PRIORITY_LOW, PRIORITY_STANDARD, PRIORITY_HIGH],
        x => `.dominantSpeakerPriority = "${x}"`
      ],
      [
        [PRIORITY_LOW, PRIORITY_STANDARD, PRIORITY_HIGH],
        x => `and the publish priority of the Dominant Speaker's LocalVideoTrack is "${x}"`
      ],
      [
        [PRIORITY_LOW, PRIORITY_STANDARD, PRIORITY_HIGH],
        x => `and the publish priority of the Passive Speaker's LocalVideoTrack is "${x}"`
      ]
    ], ([trackLimitOptions, dominantSpeakerPriority, dominantSpeakerPublishPriority, passiveSpeakerPublishPriority]) => {
      const priorityRanks = {
        [PRIORITY_HIGH]: 1,
        [PRIORITY_STANDARD]: 2,
        [PRIORITY_LOW]: 3
      };

      // NOTE(mmalavalli): Since "dominantSpeakerPriority" only upgrades the priority of the Dominant Speaker's
      // LocalVideoTrack and does not downgrade it, the effective subscribe priority will be the greater of the
      // two priorities.
      const effectiveDominantSpeakerPriority = priorityRanks[dominantSpeakerPriority] <= priorityRanks[dominantSpeakerPublishPriority]
        ? dominantSpeakerPriority
        : dominantSpeakerPublishPriority;

      const switchOffParticipant = priorityRanks[effectiveDominantSpeakerPriority] <= priorityRanks[passiveSpeakerPublishPriority]
        ? 'passive'
        : 'dominant';

      let thisRoom;
      let thoseRooms;

      beforeEach(async () => {
        [, thisRoom, thoseRooms] = await setup({
          testOptions: {
            bandwidthProfile: {
              video: {
                dominantSpeakerPriority,
                ...trackLimitOptions
              }
            },
            dominantSpeaker: true,
            tracks: [],
            loggerName: 'Charlie',
          },
          otherOptions: { tracks: [], loggerName: 'AliceAndBob' },
          participantNames: ['Charlie', 'Alice', 'Bob'],
          nTracks: 0
        });
        const charlieLogger = Logger.getLogger('Charlie');
        const aliceAndBobLogger = Logger.getLogger('AliceAndBob');
        charlieLogger.setLevel('WARN');
        aliceAndBobLogger.setLevel('ERROR');
      });

      it(`should switch off RemoteVideoTracks that are published by the ${capitalize(switchOffParticipant)} Speaker`, async () => {
        const [aliceTracks, bobTracks] = await waitFor([1, 2].map(async () => [
          createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
          await createLocalVideoTrack(smallVideoConstraints)
        ]), 'local tracks');

        // Initially disable Alice's audio
        aliceTracks[0].enabled = false;

        const [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
        const [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

        // Alice and Bob publish their LocalTracks
        await waitFor([
          ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: passiveSpeakerPublishPriority })),
          ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: dominantSpeakerPublishPriority })),
          tracksSubscribed(aliceRemote, 2),
          tracksSubscribed(bobRemote, 2)
        ], `all tracks to get published and subscribed: ${thisRoom.sid}`);

        const [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
          return [...videoTracks.values()][0].track;
        });

        monitorTrackSwitchOffs(aliceRemoteVideoTrack, 'Alice\'s Track');
        monitorTrackSwitchOffs(bobRemoteVideoTrack, 'Bob\'s Track');

        // for a participant (dominant, passive ) that gets switched off, what will be off an don
        const switched = {
          dominant: {
            off: { participant: bobRemote, remoteVideoTrack: bobRemoteVideoTrack },
            on: { participant: aliceRemote, remoteVideoTrack: aliceRemoteVideoTrack }
          },
          passive: {
            off: { participant: aliceRemote, remoteVideoTrack: aliceRemoteVideoTrack },
            on: { participant: bobRemote, remoteVideoTrack: bobRemoteVideoTrack }
          }
        }[switchOffParticipant];

        const dominantSpeakerChangedPromise = dominantSpeakerChanged(thisRoom, bobRemote);
        await waitFor(dominantSpeakerChangedPromise, `Bob to be dominant speaker: ${thisRoom.sid}`, 30000, true);


        const trackSwitchedOnPromise = trackSwitchedOn(switched.on.remoteVideoTrack);
        await waitFor(trackSwitchedOnPromise, `Track [${switched.on.remoteVideoTrack.sid}] to switch on: ${thisRoom.sid}`, 30000, true);
        switched.on.participant.videoTracks.forEach(({ track }) => {
          assert.equal(track.isSwitchedOff, false, `Track [${track.sid} isSwitchedOff = ${track.isSwitchedOff}]`);
        });

        const trackSwitchedOffPromise = trackSwitchedOff(switched.off.remoteVideoTrack);
        await waitFor(trackSwitchedOffPromise, `Track [${switched.off.remoteVideoTrack.sid}] to switch off: ${thisRoom.sid}`, 30000, true);
        switched.off.participant.videoTracks.forEach(({ track }) => {
          assert.equal(track.isSwitchedOff, true, `Track [${track.sid} isSwitchedOff = ${track.isSwitchedOff}]`);
        });
      });

      afterEach(async () => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        if (thisRoom) {
          await completeRoom(thisRoom.sid);
        }
      });
    });
  });

  describe('bandwidthProfile.video.trackSwitchOffMode', () => {
    [MODE_DISABLED, MODE_DETECTED, MODE_PREDICTED].forEach(trackSwitchOffMode => {
      it(`should accept trackSwitchOffMode=${trackSwitchOffMode}`,  async () => {
        const sid = await createRoom(randomName(), defaults.topology);
        try {
          const options = Object.assign({ name: sid, bandwidthProfile: { video: { trackSwitchOffMode } } }, defaults);
          const room = await connect(getToken(randomName()), options);
          room.disconnect();
        } catch (err) {
          throw new Error(err.message + ': ' + sid);
        }
        await completeRoom(sid);
      });
    });
  });
});
