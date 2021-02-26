/* eslint-disable no-console */
/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const defaults = require('../../lib/defaults');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { Logger } = require('../../../lib');

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
  waitFor,
  setupAliceAndBob,
  assertMediaFlow
} = require('../../lib/util');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const { trackSwitchOffMode: { MODE_DISABLED, MODE_DETECTED, MODE_PREDICTED } } = require('../../../lib/util/constants');

function monitorTrackSwitchOffs(remoteTrack, trackName) {
  console.log(`${trackName} [${remoteTrack.sid}] ${remoteTrack.isSwitchedOff ? 'OFF' : 'ON'}`);
  remoteTrack.on('switchedOff', () => {
    console.log(`${trackName} [${remoteTrack.sid}] OFF!`);
  });
  remoteTrack.on('switchedOn', () => {
    console.log(`${trackName} [${remoteTrack.sid}] ON!`);
  });
}

describe('BandwidthProfileOptions', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  // this.retries(2);

  if (defaults.topology === 'peer-to-peer') {
    it('should not run', () => {});
    return;
  }

  describe('VMS-3244', () => {
    let thisRoom;
    let thoseRooms;

    beforeEach(async () => {
      [, thisRoom, thoseRooms] = await setup({
        testOptions: {
          loggerName: 'Charlie',
          bandwidthProfile: {
            video: {
              dominantSpeakerPriority: PRIORITY_STANDARD,
              maxTracks: 1
            }
          },
          dominantSpeaker: true,
          tracks: []
        },
        otherOptions: { tracks: [], loggerName: 'AliceAndBob' },
        nTracks: 0,
        participantNames: ['Charlie', 'Alice', 'Bob']
      });

      const charlieLogger = Logger.getLogger('Charlie');
      const aliceAndBobLogger = Logger.getLogger('AliceAndBob');
      charlieLogger.setLevel('WARN');
      aliceAndBobLogger.setLevel('ERROR');
    });

    afterEach(async () => {
      [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
      if (thisRoom) {
        await completeRoom(thisRoom.sid);
      }
    });


    it('is fixed', async () => {
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
        ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        tracksSubscribed(aliceRemote, 2, 'subscribed to Alice'),
        tracksSubscribed(bobRemote, 2, 'subscribed to Bob')
      ], `all tracks to get published and subscribed: ${thisRoom.sid}`);

      const [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
        return [...videoTracks.values()][0].track;
      });

      monitorTrackSwitchOffs(aliceRemoteVideoTrack, 'Alice\'s Track');
      monitorTrackSwitchOffs(bobRemoteVideoTrack, 'Bob\'s Track');

      const bobDominant = dominantSpeakerChanged(thisRoom, bobRemote);
      await waitFor(bobDominant, `Bob to be dominant speaker: ${thisRoom.sid}`, 30000, true);

      await waitFor(trackSwitchedOn(bobRemoteVideoTrack), `Bob's Track to switch on: ${thisRoom.sid}`, 30000, true);
      assert.strictEqual(bobRemoteVideoTrack.isSwitchedOff, false, `Bob's Track.isSwitchedOff = ${bobRemoteVideoTrack.isSwitchedOff}`);

      await waitFor(trackSwitchedOff(aliceRemoteVideoTrack), `Alice's Track [${aliceRemoteVideoTrack.sid}] to switch off: ${thisRoom.sid}`, 30000, true);
      assert.strictEqual(aliceRemoteVideoTrack.isSwitchedOff, true, `Alice's Track.isSwitchedOff = ${aliceRemoteVideoTrack.isSwitchedOff}`);
    });
  });

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

  describe('renderHints', () => {
    it('Bob can turn On/Off Alice\'s track on demand', async () => {
      const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
      const aliceOptions = { tracks: [aliceLocalVideo] };
      const bobOptions = {
        tracks: [],
        loggerName: 'BobLogger',
        bandwidthProfile: {
          video: { dominantSpeakerPriority: PRIORITY_STANDARD }
        },
      };

      const bobLogger = Logger.getLogger('BobLogger');
      bobLogger.setLevel('info');

      const { roomSid, bobRoom, aliceRemote } = await setupAliceAndBob({ aliceOptions,  bobOptions });

      await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
      const aliceRemoteTrack = Array.from(aliceRemote.videoTracks.values())[0].track;

      // initially track should be switched on
      await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
      assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
      await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);

      // call _setRenderHint to force switch OFF the track.
      aliceRemoteTrack._setRenderHint({ enabled: false });
      await waitFor(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch off: ${roomSid}`);
      assert.strictEqual(aliceRemoteTrack.isSwitchedOff, true, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
      await assertMediaFlow(bobRoom, false, `was not expecting media flow: ${roomSid}`);

      // call _setRenderHint to force switch ON the track.
      aliceRemoteTrack._setRenderHint({ enabled: true });
      await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
      assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
      await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
    });
  });
});

