/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { trackPriority } = require('../../../lib/util/constants');
const LocalDataTrack = require('../../../lib/media/track/es5/localdatatrack');
const defaults = require('../../lib/defaults');
const { completeRoom, createRoom } = require('../../lib/rest');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const { isFirefox } = require('../../lib/guessbrowser');

const {
  combinationContext,
  createSyntheticAudioStreamTrack,
  setup,
  smallVideoConstraints,
  randomName,
  participantsConnected,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitForSometime,
  waitFor
} = require('../../lib/util');

const {
  PRIORITY_HIGH,
  PRIORITY_LOW,
  PRIORITY_STANDARD
} = trackPriority;

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

    if (defaults.topology !== 'peer-to-peer') {
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

(defaults.topology === 'peer-to-peer' ? describe.skip : describe)('JSDK-2707', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  let aliceRoom;
  let bobRoom;

  afterEach(() => {
    [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
  });

  ['Alice', 'Bob'].forEach(subscriber => {
    it(`${subscriber} can can control subscriber priority`, async () => {
      const [trackA, trackB] = await Promise.all(['trackA', 'trackB'].map(name => createLocalVideoTrack(Object.assign({ name }, smallVideoConstraints))));
      const roomName = await createRoom(randomName(), defaults.topology);
      const connectOptions = Object.assign({
        name: roomName,
        tracks: [],
        logLevel: 'warn',
        bandwidthProfile: {
          video: { maxTracks: 1,  dominantSpeakerPriority: 'low' }
        },
      }, defaults);

      // Alice joins room first.
      aliceRoom = await waitFor(connect(getToken('Alice'), connectOptions), 'Alice to connect to room');

      // JSDK-2707 caused track signaling to not get setup for late RemoteParticipant.
      // to force the repro this wait is needed.
      await waitForSometime(5000);
      const roomSid = aliceRoom.sid;

      // Bob joins room later.
      bobRoom = await waitFor(connect(getToken('Bob'), connectOptions), `Bob to join room: ${roomSid}`);

      // wait for Bob and alice to see each other connected.
      await waitFor(participantsConnected(bobRoom, 1), `Bob to see Alice connected: ${roomSid}`);
      await waitFor(participantsConnected(aliceRoom, 1), `Alice to see Bob connected: ${roomSid}`);

      const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
      const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);
      const publisherLocal = subscriber === 'Alice' ? bobRoom.localParticipant : aliceRoom.localParticipant;
      const publisherRemote =  subscriber === 'Alice' ? bobRemote : aliceRemote;

      // publisher publishes both tracks at standard priority.
      await waitFor([
        publisherLocal.publishTrack(trackA, { priority: PRIORITY_STANDARD }),
        publisherLocal.publishTrack(trackB, { priority: PRIORITY_STANDARD }),
        tracksSubscribed(publisherRemote, 2),
      ], 'tracks to get published and subscribed');

      const [remoteTrackA, remoteTrackB] = [trackA, trackB].map(t => [...publisherRemote.videoTracks.values()].find(track => track.trackName === t.name)).map(pub => pub.track);

      remoteTrackA.setPriority(PRIORITY_LOW);
      await waitFor([
        waitFor(trackSwitchedOn(remoteTrackB), `track B switched on: ${roomSid}`),
        waitFor(trackSwitchedOff(remoteTrackA), `track A to get switched off: ${roomSid}`)
      ], `trackB => On, trackA => Off: ${roomSid}`);

      remoteTrackA.setPriority(PRIORITY_HIGH);
      await waitFor([
        waitFor(trackSwitchedOn(remoteTrackA), `track A switched on: ${roomSid}`),
        waitFor(trackSwitchedOff(remoteTrackB), `track B to get switched off: ${roomSid}`)
      ], `trackA => On, trackB => Off: ${roomSid}`);
    });
  });
});

(isFirefox && defaults.topology === 'peer-to-peer' ? describe.skip : describe)('RemoteDataTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  let aliceRoom;
  let bobRoom;

  afterEach(() => {
    [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
  });

  combinationContext([
    [
      [true, false],
      x => `published by ${x ? 'first' : 'second'} participant`
    ],
    [
      [true, false],
      x => `${x ? 'during' : 'after'} connect`
    ],
  ], ([dataTrackCreatedByFirstParticipant, dataTrackCreatedDuringConnect]) => {
    it('messages can be sent and received on data tracks', async () => {
      const dataTrack = new LocalDataTrack();
      const roomName = await createRoom(randomName(), defaults.topology);

      const firstParticipantOptions = Object.assign({
        name: roomName,
        tracks: dataTrackCreatedDuringConnect && dataTrackCreatedByFirstParticipant ? [dataTrack] : [],
        logLevel: 'warn'
      }, defaults);

      // alice joins room first.
      aliceRoom = await connect(getToken('Alice'), firstParticipantOptions);
      const roomSid = aliceRoom.sid;

      if (!dataTrackCreatedDuringConnect && dataTrackCreatedByFirstParticipant) {
        await waitFor(aliceRoom.localParticipant.publishTrack(dataTrack), `Alice to publish a dataTrack: ${roomSid}`);
      }

      const secondParticipantOptions = Object.assign({
        name: roomName,
        tracks: dataTrackCreatedDuringConnect && !dataTrackCreatedByFirstParticipant ? [dataTrack] : [],
        logLevel: 'warn'
      }, defaults);

      // bob joins room later.
      bobRoom = await waitFor(connect(getToken('Bob'), secondParticipantOptions), `Bob to connect to room: ${roomSid}`);
      assert.equal(bobRoom.sid, roomSid);

      if (!dataTrackCreatedDuringConnect && !dataTrackCreatedByFirstParticipant) {
        await waitFor(bobRoom.localParticipant.publishTrack(dataTrack), `Bob to publish a dataTrack: ${roomSid}`);
      }

      await waitFor(participantsConnected(bobRoom, 1), `Bob to see Alice connected: ${roomSid}`);
      await waitFor(participantsConnected(aliceRoom, 1), `Alice to see Bob connected: ${roomSid}`);

      const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
      const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);

      const remoteTrackPublisher = dataTrackCreatedByFirstParticipant ? aliceRemote : bobRemote;

      await waitFor(tracksSubscribed(remoteTrackPublisher, 1), `Subscriber to see Publisher's track: ${roomSid}`);

      const tracks = getTracksOfKind(remoteTrackPublisher, 'data');
      assert.equal(tracks.length, 1);
      const remoteDataTrack = tracks[0];

      dataTrack.send('one');

      const messagePromise = new Promise(resolve =>  remoteDataTrack.on('message', resolve));
      const messageReceived = await waitFor(messagePromise, `to receive 1st message: ${roomSid}`);
      assert.equal(messageReceived, 'one');
    });
  });
});
