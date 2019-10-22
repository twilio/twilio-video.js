/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const defaults = require('../../lib/defaults');
const { completeRoom } = require('../../lib/rest');

const {
  capitalize,
  combinationContext,
  createSyntheticAudioStreamTrack,
  dominantSpeakerChanged,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor
} = require('../../lib/util');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const { trackSwitchOfMode: { MODE_DISABLED, MODE_PREDICTED } } = require('../../../lib/util/constants');

describe('Bandwidth Management', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);


  if (defaults.topology !== 'peer-to-peer') {
    describe('bandwidthProfile.video', () => {
      combinationContext([
        [
          [{ maxSubscriptionBitrate: 400 }, { maxTracks: 1 }],
          ({ maxSubscriptionBitrate, maxTracks }) => maxSubscriptionBitrate
            ? `.maxSubscriptionBitrate = ${maxSubscriptionBitrate}`
            : `.maxTracks = ${maxTracks}`
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

        // NOTE(mmalavalli): Since "dominantSpeakerPriority" only upgrades the publish priority of the Dominant Speaker's
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
              tracks: []
            },
            otherOptions: { tracks: [] },
            nTracks: 0
          });
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
          ], 'all tracks to get published and subscribed');

          const [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
            return [...videoTracks.values()][0].track;
          });

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

          // Bob should be the Dominant Speaker
          await waitFor([
            dominantSpeakerChanged(thisRoom, bobRemote),
            trackSwitchedOn(switched.on.remoteVideoTrack),
            trackSwitchedOff(switched.off.remoteVideoTrack)
          ], 'Bob to be dominant speaker');

          switched.on.participant.videoTracks.forEach(({ track }) => {
            assert.equal(track.isSwitchedOff, false);
          });

          switched.off.participant.videoTracks.forEach(({ track }) => {
            assert.equal(track.isSwitchedOff, true);
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

    describe.only('bandwidthProfile.video.trackSwitchOffMode', () => {
      [MODE_DISABLED, MODE_PREDICTED].forEach((trackSwitchOffMode) => {
        const expectSwitchOff = (trackSwitchOffMode !== MODE_DISABLED);
        it(`${expectSwitchOff ? 'Should' : 'Should not'} switch off remote tracks when trackSwitchOffMode = ${trackSwitchOffMode}`, async () => {
          console.log("expectSwitchOff = ", expectSwitchOff);
          console.log("trackSwitchOffMode = ", trackSwitchOffMode);
          const [, thisRoom, thoseRooms] = await setup({
            testOptions: {
              bandwidthProfile: {
                video: {
                  trackSwitchOffMode,
                  dominantSpeakerPriority: PRIORITY_LOW,
                  maxTracks: 1
                }
              },
              dominantSpeaker: true,
              tracks: []
            },
            otherOptions: { tracks: [] },
            nTracks: 0
          });

          const [aliceTracks, bobTracks] = await waitFor([1, 2].map(async () => [
            createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
            await createLocalVideoTrack(smallVideoConstraints)
          ]), 'local tracks');

          // Initially disable Alice's audio
          aliceTracks[0].enabled = false;

          const [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
          const [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

          // Alice publishes her track at low Pri. Bob publish his at Hi Pri
          await waitFor([
            ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
            ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_HIGH })),
            tracksSubscribed(aliceRemote, 2),
            tracksSubscribed(bobRemote, 2)
          ], `all tracks to get published and subscribed: ${thisRoom.sid}`);

          const [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
            return [...videoTracks.values()][0].track;
          });

          // eslint-disable-next-line no-console
          aliceRemoteVideoTrack.on('switchedOff', () => console.log('Alice track got switched Off'));
          // eslint-disable-next-line no-console
          aliceRemoteVideoTrack.on('switchedOn', () => console.log('Alice track got switched On'));
          // eslint-disable-next-line no-console
          bobRemoteVideoTrack.on('switchedOff', () => console.log('Bob track got switched Off'));
          // eslint-disable-next-line no-console
          bobRemoteVideoTrack.on('switchedOn', () => console.log('Bob track got switched On'));

          // Bob should be the Dominant Speaker
          await waitFor([
            dominantSpeakerChanged(thisRoom, bobRemote),
            trackSwitchedOn(bobRemoteVideoTrack),
            expectSwitchOff ? trackSwitchedOff(aliceRemoteVideoTrack) : trackSwitchedOn(aliceRemoteVideoTrack)
          ], `Bob to be dominant speaker and correct trackSwitches: ${thisRoom.sid}`);

          // wait for 5 seconds, to ensure that we do not get unwanted switchOn/Offs

          await waitFor(new Promise((resolve) => setTimeout(resolve, 5000)));
          bobRemote.videoTracks.forEach(({ track }) => {
            assert.equal(track.isSwitchedOff, false, `Was expecting Bob's track to be switchedOn: ${thisRoom.sid}`);
          });

          aliceRemote.videoTracks.forEach(({ track }) => {
            assert.equal(track.isSwitchedOff, expectSwitchOff, `Was expecting Alice's track to be isSwitchedOff=${expectSwitchOff} : ${thisRoom.sid}`);
          });

          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          if (thisRoom) {
            await completeRoom(thisRoom.sid);
          }
        });
      });
    });
  }
});

