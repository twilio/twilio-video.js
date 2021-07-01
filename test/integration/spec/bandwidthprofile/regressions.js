/* eslint-disable no-console */
/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../../lib/createlocaltrack');
const defaults = require('../../../lib/defaults');
const { completeRoom } = require('../../../lib/rest');
const { Logger } = require('../../../../lib');

const {
  createSyntheticAudioStreamTrack,
  dominantSpeakerChanged,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor
} = require('../../../lib/util');

const { trackPriority: { PRIORITY_STANDARD } } = require('../../../../lib/util/constants');

function monitorTrackSwitchOffs(remoteTrack, trackName) {
  console.log(`${trackName} [${remoteTrack.sid}] ${remoteTrack.isSwitchedOff ? 'OFF' : 'ON'}`);
  remoteTrack.on('switchedOff', () => {
    console.log(`${trackName} [${remoteTrack.sid}] OFF!`);
  });
  remoteTrack.on('switchedOn', () => {
    console.log(`${trackName} [${remoteTrack.sid}] ON!`);
  });
}

describe('BandwidthProfileOptions: regressions', function() {
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
});

