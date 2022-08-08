/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { trackPriority } = require('../../../es5/util/constants');
const LocalDataTrack = require('../../../es5/media/track/localdatatrack');
const defaults = require('../../lib/defaults');
const { completeRoom, createRoom } = require('../../lib/rest');
const { connect, createLocalAudioTrack, createLocalVideoTrack } = require('../../../es5');
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
  trackEnabled,
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

(defaults.largeRoom ? describe : describe.skip)('RemoteAudioTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('when subscribed to by the LocalParticipant', () => {
    let aliceRemoteAudioTracks;
    let aliceRemoteForBob;
    let aliceRemoteForCharlie;
    let aliceRoom;
    let bobRoom;
    let charlieRoom;

    before(async () => {
      [, aliceRoom, [bobRoom, charlieRoom]] = await waitFor(setup({
        testOptions: { audio: true, video: false },
        otherOptions: { audio: false, video: false },
        participantNames: ['alice', 'bob', 'charlie'],
        nTracks: 0
      }), 'Alice, Bob and Charlie to join a Room');

      const { localParticipant: { sid: aliceParticipantSid } } = aliceRoom;
      aliceRemoteForBob = bobRoom.participants.get(aliceParticipantSid);
      aliceRemoteForCharlie = charlieRoom.participants.get(aliceParticipantSid);
      return waitFor([
        tracksSubscribed(aliceRemoteForBob, 1),
        tracksSubscribed(aliceRemoteForCharlie, 1)
      ], `Bob (SID: ${bobRoom.localParticipant.sid}) and Charlie (SID: ${charlieRoom.localParticipant.sid}) to subscribe to Alice's (SID: ${aliceParticipantSid}) AudioTrack`);
    });

    it('should initially be switched off with the reason "disabled-by-subscriber"', () => {
      aliceRemoteAudioTracks = [aliceRemoteForBob, aliceRemoteForCharlie].map(aliceRemote =>
        aliceRemote.audioTracks.values().next().value.track);
      assert.equal(aliceRemoteAudioTracks.length, 2);
      aliceRemoteAudioTracks.forEach(aliceRemoteAudioTrack => {
        assert.equal(aliceRemoteAudioTrack.isSwitchedOff, true);
        assert.equal(aliceRemoteAudioTrack.mediaStreamTrack, null);
        assert.equal(aliceRemoteAudioTrack.switchOffReason, 'disabled-by-subscriber');
      });
    });

    it('should later be switched on', async () => {
      await waitFor(
        aliceRemoteAudioTracks.map(trackSwitchedOn),
        'Alice\'s RemoteAudioTracks to be switched on'
      );
      aliceRemoteAudioTracks.forEach(aliceRemoteAudioTrack => {
        assert.equal(aliceRemoteAudioTrack.isSwitchedOff, false);
        assert(aliceRemoteAudioTrack.mediaStreamTrack instanceof MediaStreamTrack);
        assert.equal(aliceRemoteAudioTrack.switchOffReason, null);
      });
    });

    after(() => {
      [aliceRoom, bobRoom, charlieRoom].forEach(room => room && room.disconnect());
    });
  });

  // TODO(mmalavalli) Enable test once SFU implements this behavior.
  describe.skip('enable/disable', () => {
    let aliceRoom;
    let bobRoom;
    let charlieRoom;
    let daveRoom;

    before(async () => {
      [, aliceRoom, [bobRoom, charlieRoom]] = await waitFor(setup({
        testOptions: { audio: true, video: false },
        otherOptions: { audio: true, video: false },
        participantNames: ['Alice', 'Bob', 'Charlie'],
        nTracks: 1
      }), 'Alice, Bob and Charlie to join a Room');

      daveRoom = await waitFor(connect(getToken('Dave'), Object.assign({
        audio: false,
        name: aliceRoom.name,
        video: false
      }, defaults)), `Dave to join a Room (SID: ${aliceRoom.sid})`);

      await waitFor(
        participantsConnected(daveRoom, 3),
        `Alice (SID: ${aliceRoom.localParticipant.sid}), Bob (SID: ${bobRoom.localParticipant.sid}) and Charlie (SID: ${charlieRoom.localParticipant.sid}) to be visible to Dave (SID: ${daveRoom.localParticipant.sid}) as RemoteParticipants`
      );

      const participants = [...daveRoom.participants.values()];

      await waitFor(
        participants.map(participant => tracksSubscribed(participant, 1)),
        'Dave to subscribe to Alice, Bob and Charlie\'s AudioTracks'
      );

      const daveRemoteTracks = participants
        .flatMap(participant => [...participant.audioTracks.values()])
        .map(({ track }) => track);

      await waitFor(
        new Promise(resolve => {
          let nSwitchedOn = 0;
          daveRemoteTracks.map(trackSwitchedOn).forEach(switchedOn => switchedOn.then(() => {
            nSwitchedOn++;
            // TODO(mmalavalli): Update max tracks switched on limit once SFU sets the final number.
            if (nSwitchedOn >= 2) {
              resolve();
            }
          }));
        }),
        'Max AudioTracks for Dave to be switched on'
      );
    });

    ['Alice', 'Bob', 'Charlie'].forEach(identity => {
      [false, true].forEach(isEnabled => {
        context(`when ${identity} ${isEnabled ? 'enables' : 'disables'} the LocalAudioTrack`, () => {
          let remoteTrack;

          before(() => {
            const room = [aliceRoom, bobRoom, charlieRoom].find(({ localParticipant }) => localParticipant.identity === identity);
            const localTrack = room.localParticipant.audioTracks.values().next().value.track;
            localTrack[isEnabled ? 'enable' : 'disable']();
            const { track } = daveRoom.participants.get(room.localParticipant.sid).audioTracks.values().next().value;
            remoteTrack = track;
            return isEnabled ? waitFor([
              trackSwitchedOn(remoteTrack),
              trackEnabled(remoteTrack, true)
            ], `${identity}'s RemoteAudioTrack to be switched on and enabled`) : waitFor([
              trackSwitchedOff(remoteTrack),
              trackEnabled(remoteTrack, false)
            ], `${identity}'s RemoteAudioTrack to be switched off and disabled`);
          });

          it(`should ${isEnabled ? 'switch on and enable' : 'switch off and disable'} ${identity}'s RemoteAudioTrack with reason ${isEnabled ? 'null' : '"disabled-by-publisher"'}`, () => {
            assert.equal(remoteTrack.isEnabled, isEnabled);
            assert.equal(remoteTrack.isSwitchedOff, !isEnabled);
            assert.equal(remoteTrack.switchOffReason, isEnabled ? null : 'disabled-by-publisher');
          });
        });
      });
    });

    after(() => {
      [aliceRoom, bobRoom, charlieRoom, daveRoom].forEach(room => room && room.disconnect());
    });
  });

  describe('switch on/off', () => {
    let aliceRoom;
    let bobRoom;
    let charlieRoom;
    let daveRoom;

    before(async () => {
      const name = await createRoom(randomName(), defaults.topology);
      [aliceRoom, bobRoom, charlieRoom] = await waitFor(['Alice', 'Bob', 'Charlie'].map(identity => {
        const token = getToken(identity);
        return connect(token, Object.assign({
          name,
          tracks: [createSyntheticAudioStreamTrack()]
        }, defaults));
      }), `Alice, Bob and Charlie to join a Room (SID: ${name})`);

      daveRoom = await waitFor(connect(getToken('Dave'), Object.assign({
        audio: false,
        name,
        video: false
      }, defaults)), `Dave to join a Room (SID: ${name})`);

      await waitFor(
        participantsConnected(daveRoom, 3),
        `Alice (SID: ${aliceRoom.localParticipant.sid}), Bob (SID: ${bobRoom.localParticipant.sid}) and Charlie (SID: ${charlieRoom.localParticipant.sid}) to be visible to Dave (SID: ${daveRoom.localParticipant.sid}) as RemoteParticipants`
      );

      const participants = [...daveRoom.participants.values()];

      await waitFor(
        participants.map(participant => tracksSubscribed(participant, 1)),
        'Dave to subscribe to Alice, Bob and Charlie\'s AudioTracks'
      );

      const daveRemoteTracks = participants
        .flatMap(participant => [...participant.audioTracks.values()])
        .map(({ track }) => track);

      await waitFor(
        new Promise(resolve => {
          let nSwitchedOn = 0;
          daveRemoteTracks.map(trackSwitchedOn).forEach(switchedOn => switchedOn.then(() => {
            nSwitchedOn++;
            // TODO(mmalavalli): Update max tracks switched on limit once SFU sets the final number.
            if (nSwitchedOn >= 2) {
              resolve();
            }
          }));
        }),
        'Max AudioTracks for Dave to be switched on'
      );
    });

    ['Alice', 'Bob', 'Charlie'].forEach(identity => {
      context(`when ${identity} silences the LocalAudioTrack`, () => {
        let localTrack;
        let remoteTrack;

        before(() => {
          const room = [aliceRoom, bobRoom, charlieRoom].find(({ localParticipant }) => localParticipant.identity === identity);
          localTrack = room.localParticipant.audioTracks.values().next().value.track;
          localTrack.mediaStreamTrack.silence();
          const { track } = daveRoom.participants.get(room.localParticipant.sid).audioTracks.values().next().value;
          remoteTrack = track;
          return waitFor(trackSwitchedOff(remoteTrack), `${identity}'s RemoteAudioTrack (SID: ${remoteTrack.sid}) to be switched off`);
        });

        it(`should switch off ${identity}'s RemoteAudioTrack with reason "max-tracks-switched-on"`, () => {
          assert.equal(remoteTrack.isSwitchedOff, true);
          assert.equal(remoteTrack.switchOffReason, 'max-tracks-switched-on');
        });

        after(() => {
          localTrack.mediaStreamTrack.sound();
        });
      });
    });

    after(() => {
      [aliceRoom, bobRoom, charlieRoom, daveRoom].forEach(room => {
        if (room) {
          room.disconnect();
          room.localParticipant.tracks.forEach(({ track }) => track.stop());
        }
      });
    });
  });
});

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
      [, thisRoom, thoseRooms] = await waitFor(setup({
        testOptions: {
          bandwidthProfile: {
            video: {
              maxTracks: 1,
              dominantSpeakerPriority: 'low'
            }
          },
          tracks: [dataTrack]
        },
        otherOptions: { tracks: [dataTrack] },
        nTracks: 0
      }), 'creating room');

      [aliceTracks, bobTracks] = await waitFor(['alice', 'bob'].map(async () => [
        createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
        await createLocalVideoTrack(smallVideoConstraints),
      ]), 'create local tracks');

      [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
      [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

      // Alice publishes her tracks at low priority
      // Bob publishes his tracks at standard priority
      await waitFor([
        ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
        ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        tracksSubscribed(aliceRemote, 3),
        tracksSubscribed(bobRemote, 3)
      ], `alice and bob to subscribe each others tracks: ${thisRoom.sid} `);

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
          video: {
            maxSwitchedOnTracks: 1,
            dominantSpeakerPriority: 'low'
          }
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

      const message = {
        x: 4,
        y: 5
      };
      dataTrack.send(JSON.stringify(message));

      const messagePromise = new Promise(resolve =>  remoteDataTrack.on('message', resolve));
      const messageReceived = await waitFor(messagePromise, `to receive 1st message: ${roomSid}`);
      assert.deepEqual(JSON.parse(messageReceived), message);
    });
  });
});
