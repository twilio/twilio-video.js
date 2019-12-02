/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const defaults = require('../../lib/defaults');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

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
} = require('../../lib/util');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const { trackSwitchOffMode: { MODE_DISABLED, MODE_DETECTED, MODE_PREDICTED } } = require('../../../lib/util/constants');

describe('Bandwidth Management', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  this.retries(2);

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
          ], `all tracks to get published and subscribed: ${thisRoom.sid}`);

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
          ], `Bob to be dominant speaker: ${thisRoom.sid}`);

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

    describe('bandwidthProfile.video.trackSwitchOffMode', () => {
      [MODE_DISABLED, MODE_DETECTED, MODE_PREDICTED].forEach((trackSwitchOffMode) => {
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
  }
});

