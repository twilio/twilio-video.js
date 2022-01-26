/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const defaults = require('../../lib/defaults');
const { completeRoom, createRoom } = require('../../lib/rest');
const { connect, createLocalAudioTrack, createLocalVideoTrack } = require('../../../es5');
const getToken = require('../../lib/token');
const { isChrome } = require('../../lib/guessbrowser');

const {
  smallVideoConstraints,
  randomName,
  participantsConnected,
  tracksSubscribed,
  tracksUnpublished,
  waitForSometime,
  waitFor,
  trackStarted
} = require('../../lib/util');


function getTracksOfKind(participant, kind) {
  return [...participant.tracks.values()].filter(remoteTrack => remoteTrack.kind === kind).map(({ track }) => track);
}

// eslint-disable-next-line no-warning-comments
// TODO(mpatwardhan): Fix VIDEO-6356 and enable this test for p2p rooms.
(isChrome && defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('VIDEO-6336: media element leak detection', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(5 * 60 * 1000);

  it('tracks continue to start after 50 connect disconnects ', async () => {
    const localAudioTrack = await createLocalAudioTrack({ fake: true });
    const localVideoTrack = await createLocalVideoTrack(smallVideoConstraints);
    const roomName = await createRoom(randomName(), defaults.topology);
    const connectOptions = Object.assign({
      name: roomName,
      tracks: [localAudioTrack, localVideoTrack]
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

  it('tracks continue to start after 50 publish/unpublish ', async () => {
    const localAudioTrack = await createLocalAudioTrack({ fake: true });
    const localVideoTrack = await createLocalVideoTrack(smallVideoConstraints);
    const roomName = await createRoom(randomName(), defaults.topology);
    const connectOptions = Object.assign({
      name: roomName,
      tracks: []
    }, defaults);

    const aliceRoom = await waitFor(connect(getToken('Alice'), connectOptions), 'Alice to connect to room');
    const bobRoom = await waitFor(connect(getToken('Bob'), connectOptions), `Bob to join room: ${aliceRoom.sid}`);
    // wait for Bob to see alice connected.
    await waitFor(participantsConnected(bobRoom, 1), `Bob to see Alice connected: ${aliceRoom.sid}`);

    const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);

    async function publishAndVerifyStarted(i) {

      // eslint-disable-next-line no-console
      console.log(`${i}] Alice publishing tracks`);
      // alice publishes two tracks.
      const audioPublication = await waitFor(aliceRoom.localParticipant.publishTrack(localAudioTrack), `Alice to publish a audio track: ${aliceRoom.sid}`);
      const videoPublication = await waitFor(aliceRoom.localParticipant.publishTrack(localVideoTrack), `Alice to publish a video track: ${aliceRoom.sid}`);

      await waitFor(tracksSubscribed(aliceRemote, 2), `${i}] Bob to see Alice's track: ${aliceRoom.sid}`);

      const remoteVideoTracks = getTracksOfKind(aliceRemote, 'video');
      const remoteAudioTracks = getTracksOfKind(aliceRemote, 'audio');
      assert.strictEqual(remoteVideoTracks.length, 1);
      assert.strictEqual(remoteAudioTracks.length, 1);

      // bob sees tracks published by alice started.
      await waitFor(trackStarted(remoteVideoTracks[0]), `${i}] Bob to see Alice's video track started: ${aliceRoom.sid}`);
      await waitFor(trackStarted(remoteAudioTracks[0]), `${i}] Bob to see Alice's audio track started: ${aliceRoom.sid}`);

      const bobSeesUnpublished =  tracksUnpublished(aliceRemote, 2);

      // alice un-publishes tracks.
      audioPublication.unpublish();
      videoPublication.unpublish();

      // bob sees tracks unpublished.
      await waitFor(bobSeesUnpublished, `${i}] Bob to see tracks unpublished: ${aliceRoom.sid} `);

      await waitForSometime(1000);
    }

    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      await publishAndVerifyStarted(i);
    }

    aliceRoom.disconnect();
    await completeRoom(aliceRoom.sid);
  });

});
