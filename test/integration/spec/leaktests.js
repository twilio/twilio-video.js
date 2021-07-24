/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const defaults = require('../../lib/defaults');
const { completeRoom, createRoom } = require('../../lib/rest');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const { isChrome } = require('../../lib/guessbrowser');

const {
  smallVideoConstraints,
  randomName,
  participantsConnected,
  tracksSubscribed,
  waitForSometime,
  waitFor,
  trackStarted
} = require('../../lib/util');


function getTracksOfKind(participant, kind) {
  return [...participant.tracks.values()].filter(remoteTrack => remoteTrack.kind === kind).map(({ track }) => track);
}

(isChrome ? describe : describe.skip)('VIDEO-6336: media element leak detection', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(5 * 60 * 1000);

  it(' tracks works even after 50 connect disconnects ', async () => {
    const localAudioTrack = await createLocalAudioTrack({ fake: true });
    const localVideoTrack = await createLocalVideoTrack(smallVideoConstraints);
    const roomName = await createRoom(randomName(), defaults.topology);
    const connectOptions = Object.assign({
      name: roomName,
      tracks: [localAudioTrack, localVideoTrack],
      logLevel: 'warn',
    }, defaults);

    const aliceRoom = await waitFor(connect(getToken('Alice'), connectOptions), 'Alice to connect to room');
    async function joinRoomAndEnsureTracksStarted(i) {
      // eslint-disable-next-line no-console
      console.log(`${i}] connecting to room ${aliceRoom.sid}`);
      const bobRoom = await waitFor(connect(getToken('Bob'), connectOptions), `${i}] Bob to join room: ${aliceRoom.sid}`);

      // wait for Bob to see alice connected.
      await waitFor(participantsConnected(bobRoom, 1), `${i}] Bob to see Alice connected: ${aliceRoom.sid}`);

      const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
      await waitFor(tracksSubscribed(aliceRemote, 2), `${i}] Bob to see Alice's track: ${aliceRoom.sid}`);

      const remoteVideoTracks = getTracksOfKind(aliceRemote, 'video');
      const remoteAudioTracks = getTracksOfKind(aliceRemote, 'audio');
      assert.strictEqual(remoteVideoTracks.length, 1);
      assert.strictEqual(remoteAudioTracks.length, 1);

      await waitFor(trackStarted(remoteVideoTracks[0]), `${i}] Bob to see Alice's video track started: ${aliceRoom.sid}`);
      await waitFor(trackStarted(remoteAudioTracks[0]), `${i}] Bob to see Alice's audio track started: ${aliceRoom.sid}`);
      bobRoom.disconnect();
      await waitForSometime(1000);
    }

    // Alice joins room first.
    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      await joinRoomAndEnsureTracksStarted(i);
    }

    aliceRoom.disconnect();
    await completeRoom(aliceRoom.sid);
  });
});
