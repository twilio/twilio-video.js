/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { trackPriority } = require('../../../lib/util/constants');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const LocalDataTrack = require('../../../lib/media/track/es5/localdatatrack');
const defaults = require('../../lib/defaults');
const { completeRoom } = require('../../lib/rest');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const connect = require('../../../lib/connect');
const { createRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  createSyntheticAudioStreamTrack,
  setup,
  smallVideoConstraints,
  randomName,
  participantsConnected,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  setupAliceAndBob,
  waitFor
} = require('../../lib/util');

function getTracksOfKind(participant, kind) {
  return [...participant.tracks.values()].filter(remoteTrack => remoteTrack.kind === kind).map(({ track }) => track);
}


describe('RemoteVideoTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('#setPriority', () => {
    let thisRoom;
    let thoseRooms;
    let aliceLocal;
    let bobLocal;
    let aliceRemote;
    let bobRemote;
    let aliceTracks;
    let bobTracks;
    let aliceRemoteVideoTrack;
    let bobRemoteVideoTrack;

    beforeEach(async () => {
      const dataTrack = new LocalDataTrack();
      [, thisRoom, thoseRooms] = await setup({
        testOptions: {
          bandwidthProfile: {
            video: { maxTracks: 1,  dominantSpeakerPriority: 'low' }
          },
          tracks: [dataTrack]
        },
        otherOptions: { tracks: [dataTrack] },
        nTracks: 0
      });

      [aliceTracks, bobTracks] = await Promise.all(['alice', 'bob'].map(async () => [
        createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
        await createLocalVideoTrack(smallVideoConstraints),
      ]));

      [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
      [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

      // Alice publishes her tracks at low priority
      // Bob publishes his tracks at standard priority
      await Promise.all([
        ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
        ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        tracksSubscribed(aliceRemote, 3),
        tracksSubscribed(bobRemote, 3)
      ]);

      [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
        return [...videoTracks.values()][0].track;
      });
    });

    afterEach(async () => {
      [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
      [...aliceTracks, ...bobTracks].forEach(track => track.stop && track.stop());
      if (thisRoom) {
        await completeRoom(thisRoom.sid);
      }
    });

    ['audio', 'video', 'data'].forEach(kind => {
      [null, ...Object.values(trackPriority)].forEach(priority => {
        it(`can setpriority ${priority} on ${kind} track`, () => {
          const tracks = getTracksOfKind(aliceRemote, kind);
          assert(tracks.length > 0, 'no tracks found of kind ' + kind);
          tracks[0].setPriority(priority);
          assert.equal(tracks[0].priority, priority);
        });
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
        assert.equal(errorWasThrown, true, 'was expecting an error to be thrown, but it was not');
      });
    });

    // eslint-disable-next-line no-warning-comments
    // TODO: enable these tests when track_priority MSP is available in prod
    if (defaults.topology !== 'peer-to-peer' && (defaults.environment === 'stage' || defaults.environment === 'dev')) {
      it('subscriber can upgrade track\'s effective priority', async () => {
        await waitFor([
          waitFor(trackSwitchedOn(bobRemoteVideoTrack), `Bob's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(aliceRemoteVideoTrack), `Alice's track to get switched off: ${thisRoom.sid}`)
        ], `Bob's track to get switched on, and alice switched off: ${thisRoom.sid}`);

        // change subscriber priority of the Alice track to high
        aliceRemoteVideoTrack.setPriority(PRIORITY_HIGH);

        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          waitFor(trackSwitchedOn(aliceRemoteVideoTrack), `Alice's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(bobRemoteVideoTrack), `Bob's track to get switched off: ${thisRoom.sid}`)
        ], 'Alice track to get switched On, and Bob Switched Off:' + thisRoom.sid);
      });

      it('subscriber can downgrade track\'s effective priority', async () => {
        await waitFor([
          waitFor(trackSwitchedOn(bobRemoteVideoTrack), `Bob's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(aliceRemoteVideoTrack), `Alice's track to get switched off: ${thisRoom.sid}`)
        ], 'Bobs track to get switched On, and Alice Switched Off');

        // change subscriber priority of the Alice track to high
        bobRemoteVideoTrack.setPriority(PRIORITY_LOW);
        aliceRemoteVideoTrack.setPriority(PRIORITY_STANDARD);

        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          waitFor(trackSwitchedOn(aliceRemoteVideoTrack), `Alice's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(bobRemoteVideoTrack), `Bob's track to get switched off: ${thisRoom.sid}`)
        ], `Alice track to get switched on, and Bob switched off: ${thisRoom.sid}`);
      });

      it('subscriber can revert to track\'s effective priority', async () => {
        await waitFor([
          waitFor(trackSwitchedOn(bobRemoteVideoTrack), `Bob's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(aliceRemoteVideoTrack), `Alice's track to get switched off: ${thisRoom.sid}`)
        ], `Bob's track to get switched on, and Alice switched off: ${thisRoom.sid}`);

        // change subscriber priority of the Alice track to high
        aliceRemoteVideoTrack.setPriority(PRIORITY_HIGH);

        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          waitFor(trackSwitchedOn(aliceRemoteVideoTrack), `Alice's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(bobRemoteVideoTrack), `Bob's track to get switched off: ${thisRoom.sid}`)
        ], `Alice track to get switched on, and Bob switched off: ${thisRoom.sid}`);

        // reset subscriber priority of the Alice track
        aliceRemoteVideoTrack.setPriority(null);

        await waitFor([
          waitFor(trackSwitchedOn(bobRemoteVideoTrack), `Bob's track to get switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(aliceRemoteVideoTrack), `Alice's track to get switched off: ${thisRoom.sid}`)
        ], `Bob's track to get switched on, and Alice switched off: ${thisRoom.sid}`);
      });
    }
  });
});

describe('RemoteDataTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  it('messages can be sent and received on data tracks', async () => {
    const dataTrack = new LocalDataTrack();
    const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
      aliceOptions: { tracks: [] },
      bobOptions: { tracks: [] },
    });

    await waitFor(bobLocal.publishTrack(dataTrack), `Bob to publish a dataTrack: ${roomSid}`);
    await waitFor(tracksSubscribed(bobRemote, 1), `Alice to subscribe to Bob's track: ${roomSid}`);

    const tracks = getTracksOfKind(bobRemote, 'data');
    assert.equal(tracks.length, 1, `Alice found unexpected data tracks length: ${roomSid}`);
    const remoteDataTrack = tracks[0];

    dataTrack.send('one');

    const messagePromise = new Promise(resolve =>  remoteDataTrack.on('message', resolve));
    const messageReceived = await waitFor(messagePromise, `to receive 1st message: ${roomSid}`);
    assert.equal(messageReceived, 'one');

    aliceRoom.disconnect();
    bobRoom.disconnect();
  });

  it('JSDK-2615 - late arrivals should see data tracks', async () => {
    const aliceDataTrack = new LocalDataTrack();
    const roomName = await createRoom(randomName(), defaults.topology);
    const options = Object.assign({
      name: roomName,
      tracks: [],
      logLevel: 'warn'
    }, defaults);

    const aliceRoom = await connect(getToken('Alice'), options);
    const roomSid = aliceRoom.sid;

    await waitFor(aliceRoom.localParticipant.publishTrack(aliceDataTrack), `Alice to publish a dataTrack: ${roomSid}`);

    const bobRoom = await waitFor(connect(getToken('Bob'), options), `Bob to connect to room: ${roomSid}`);
    assert.equal(bobRoom.sid, roomSid);

    await waitFor(participantsConnected(bobRoom, 1), `Bob to see Alice connected: ${roomSid}`);
    const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
    await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);

    const tracks = getTracksOfKind(aliceRemote, 'data');
    assert.equal(tracks.length, 1, `Bob found unexpected data tracks length: ${roomSid}`);
    const remoteDataTrack = tracks[0];

    aliceDataTrack.send('one');

    const messagePromise = new Promise(resolve => remoteDataTrack.on('message', resolve));
    const messageReceived = await waitFor(messagePromise, `to receive 1st message: ${roomSid}`);
    assert.equal(messageReceived, 'one');
  });
});
