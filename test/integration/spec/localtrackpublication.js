'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../lib');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const RemoteAudioTrack = require('../../../lib/media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('../../../lib/media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('../../../lib/media/track/remotedatatrack');
const RemoteDataTrackPublication = require('../../../lib/media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('../../../lib/media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('../../../lib/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../lib/util');
const { createRoom, completeRoom } = require('../../lib/rest');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const { isFirefox } = require('../../lib/guessbrowser');

const {
  capitalize,
  combinationContext,
  createSyntheticAudioStreamTrack,
  participantsConnected,
  randomName,
  setup,
  setupAliceAndBob,
  smallVideoConstraints,
  tracksSubscribed,
  tracksUnpublished,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor,
  waitForNot,
  waitForSometime,
  waitForTracks,
  waitOnceForRoomEvent
} = require('../../lib/util');

describe('LocalTrackPublication', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  it.only('JSDK-2583 Publisher priority not synced up when subscriber reconnects', async () => {
    // Alice and Bob Join.
    const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
      aliceOptions: { tracks: [] },
      bobOptions: { tracks: [] },
    });

    // Bob publishes a track at low priority.
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    const trackAPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackA, { priority: PRIORITY_LOW }), `Bob to publish video trackA: ${roomSid}`);

    // Alice sees bob track at low priority.
    await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);
    const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);
    assert(trackAPubRemote);
    await waitFor(trackSwitchedOn(trackAPubRemote.track), `trackA=On : ${roomSid}`);
    assert.equal(trackAPubRemote.publishPriority, PRIORITY_LOW);

    // Bob updates trackA => PRIORITY_HIGH
    trackAPubLocal.setPriority(PRIORITY_HIGH);
    assert.equal(trackAPubLocal.priority, PRIORITY_HIGH);

    // Alice sees Bob track at standard priority.
    const trackPriorityChanged = new Promise(resolve => trackAPubRemote.once('publishPriorityChanged', priority => {
      assert.equal(priority, PRIORITY_HIGH);
      resolve();
    }));

    await waitFor(trackPriorityChanged, `'track priority to change to High: ${roomSid}`);
    assert.equal(trackAPubRemote.publishPriority, PRIORITY_HIGH);

    // Alice disconnects and connects back.
    aliceRoom.disconnect();
    const options = Object.assign({ name: roomSid }, defaults);

    // Alice joins a room
    const aliceRoom2 = await connect(getToken('Alice'), Object.assign({ tracks: [] }, options));
    const bobRemote2 = aliceRoom2.participants.get(bobLocal.sid);
    // Alice sees bob track at low priority.
    await waitFor(tracksSubscribed(bobRemote2, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);
    const trackAPubRemote2 = bobRemote2.videoTracks.get(trackAPubLocal.trackSid);
    assert(trackAPubRemote2);
    await waitFor(trackSwitchedOn(trackAPubRemote2.track), `trackA=On : ${roomSid}`);
    assert.equal(trackAPubRemote2.publishPriority, PRIORITY_HIGH);


    // Alice sees bob track at standard priority.
    aliceRoom2.disconnect();
    bobRoom.disconnect();
  });

  it.only('JSDK-2583 late arrivals see updated priority', async () => {
    const roomSid = await createRoom(randomName(), defaults.topology);
    const options = Object.assign({ name: roomSid }, defaults);

    // BOB joins a room
    const bobRoom = await connect(getToken('Bob'), Object.assign({ tracks: [] }, options));

    // Bob publishes a track at low priority.
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    const trackAPubLocal = await waitFor(bobRoom.localParticipant.publishTrack(bobVideoTrackA, { priority: PRIORITY_LOW }), `Bob to publish video trackA: ${roomSid}`);


    // Bob updates trackA => PRIORITY_HIGH
    trackAPubLocal.setPriority(PRIORITY_HIGH);
    assert.equal(trackAPubLocal.priority, PRIORITY_HIGH);

    // Alice joins a room after 10 seconds.
    await waitForSometime(10000);
    const aliceRoom = await connect(getToken('Alice'), Object.assign({ tracks: [] }, options));
    const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);

    // Alice sees bob track.
    await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);
    const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);

    const trackPriorityChanged = new Promise(resolve => trackAPubRemote.once('publishPriorityChanged', priority => {
      console.log('makaranda: publish priority changed!');
      assert.equal(priority, PRIORITY_HIGH);
      resolve();
    }));

    // alice waits for 10 seconds or for trackPriorityChanged to have been fired.
    await Promise.race([waitForSometime(10000), trackPriorityChanged]);

    // and at the end expects the priority of bob's track to be high.
    assert(trackAPubRemote);
    assert.equal(trackAPubRemote.publishPriority, PRIORITY_HIGH, `Alice was expecting Bob's track to have High Priority: ${roomSid}`);

    aliceRoom.disconnect();
    bobRoom.disconnect();
  });

  it('JSDK-2565: Can enable, disable and re-enable the track', async () => {
    const [, thisRoom, thoseRooms] = await waitFor(setup({}), 'rooms connected and tracks subscribed');
    const aliceRoom = thoseRooms[0];
    const aliceLocal = aliceRoom.localParticipant;

    const aliceLocalAudioTrackPublication =  [...aliceLocal.audioTracks.values()][0];
    const aliceLocalAudioTrack = aliceLocalAudioTrackPublication.track;

    // wait for things to stabilize.
    await new Promise(resolve => setTimeout(resolve, 5000));

    aliceLocalAudioTrack.disable();
    await waitOnceForRoomEvent(thisRoom, 'trackDisabled');

    aliceLocalAudioTrack.enable();
    await waitOnceForRoomEvent(thisRoom, 'trackEnabled');

    aliceLocalAudioTrack.disable();
    await waitOnceForRoomEvent(thisRoom, 'trackDisabled');

    [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
  });

  it('JSDK-2582 trackDisabled event is not fired when participant joins room with already disabled track', async () => {
    const roomSid = await createRoom(randomName(), defaults.topology);
    const options = Object.assign({ name: roomSid }, defaults);

    // Alice joins a room
    const aliceRoom = await connect(getToken('Alice'), Object.assign({ tracks: [] }, options));

    // Alice adds listener for trackDisabled events (e.g., in room level)
    const trackDisabledPromise = waitOnceForRoomEvent(aliceRoom, 'trackDisabled');

    // Bob joins the room with a disabled track
    const bobLocalAudioTrack = await createLocalAudioTrack({ fake: true });
    bobLocalAudioTrack.disable();
    const bobRoom = await connect(getToken('Bob'), Object.assign({ tracks: [bobLocalAudioTrack] }, options));

    // Alice expects trackDisabled event.
    await waitFor(trackDisabledPromise, `Alice to receive trackDisabled event: ${roomSid}`);

    [aliceRoom, bobRoom].forEach(room => room.disconnect());
    return completeRoom(roomSid);
  });

  describe('#unpublish', () => {
    combinationContext([
      [
        [true, false],
        x => `called with ${x ? 'an enabled' : 'a disabled'}`
      ],
      [
        ['audio', 'video', 'data'],
        x => `Local${capitalize(x)}Track`
      ],
      [
        ['published', 'published, unpublished, and then published again'],
        x => 'that was ' + x
      ]
    ], ([isEnabled, kind, when]) => {
      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Enable this scenario for Firefox when the following
      // bug is fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=1526253
      if (isFirefox && kind === 'data' && when !== 'published') {
        return;
      }

      let sid;
      let thisRoom;
      let thisParticipant;
      let thisLocalTrackPublication;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thosePublicationsUnsubscribed;
      let thoseTracksUnpublished;
      let thoseTracksUnsubscribed;
      let thoseTracksMap;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);
        // eslint-disable-next-line no-warning-comments
        // TODO(mroberts): Update when VIDEO-954 is fixed.
        const identities = kind === 'data'
          ? [randomName(), randomName()]
          : [randomName(), randomName(), randomName()];
        const options = Object.assign({ name: sid }, defaults);

        thisTrack = await {
          audio: createLocalAudioTrack,
          video: createLocalVideoTrack,
          data() { return new LocalDataTrack(); }
        }[kind]();

        // eslint-disable-next-line no-warning-comments
        // TODO(mroberts): Really this test needs to be refactored so that only
        // the LocalAudio- and LocalVideo-Track tests test the enable/disable
        // functionality.
        if (kind !== 'data') {
          thisTrack.enable(isEnabled);
        }

        const tracks = [thisTrack];
        const thisIdentity = identities[0];
        const thisToken = getToken(thisIdentity);
        const theseOptions = Object.assign({ tracks }, options);
        thisRoom = await connect(thisToken, theseOptions);
        thisParticipant = thisRoom.localParticipant;

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);
        thoseRooms = await waitFor(thoseTokens.map(thatToken => connect(thatToken, thoseOptions)), 'rooms to connect');

        await waitFor([thisRoom].concat(thoseRooms).map(room => {
          return participantsConnected(room, identities.length - 1);
        }), 'all participant to get connected');

        thoseParticipants = thoseRooms.map(thatRoom => {
          return thatRoom.participants.get(thisParticipant.sid);
        });

        await waitFor(thoseParticipants.map(thatParticipant => {
          return tracksSubscribed(thatParticipant, thisParticipant._tracks.size);
        }), 'all tracks to get subscribed');

        if (when !== 'published') {
          thisParticipant.unpublishTrack(thisTrack);

          await waitFor(thoseParticipants.map(thatParticipant => {
            return tracksUnpublished(thatParticipant, thisParticipant._tracks.size);
          }), 'all tracks to get unpublished');

          await waitFor([
            thisParticipant.publishTrack(thisTrack),
            ...thoseParticipants.map(thatParticipant => tracksSubscribed(thatParticipant, thisParticipant._tracks.size))
          ], 'track to get published and all tracks to get subscribe again');
        }

        thisLocalTrackPublication = [...thisParticipant.tracks.values()].find(trackPublication => {
          return trackPublication.track === thisTrack;
        });
        thisLocalTrackPublication.unpublish();

        thosePublicationsUnsubscribed = flatMap(thoseParticipants, participant => [...participant.tracks.values()]).map(publication => {
          return new Promise(resolve => publication.once('unsubscribed', resolve));
        });

        [thoseTracksUnsubscribed, thoseTracksUnpublished] = await waitFor([
          'trackUnsubscribed',
          'trackUnpublished'
        ].map(event => {
          return waitFor(thoseParticipants.map(async thatParticipant => {
            const [trackOrPublication] = await waitForTracks(event, thatParticipant, 1);
            return trackOrPublication;
          }), 'all participants to get ' + event);
        }), 'tracks to get unsubscribed and unpublished.');

        thoseTracksMap = {
          trackUnpublished: thoseTracksUnpublished,
          trackUnsubscribed: thoseTracksUnsubscribed
        };
      });

      after(() => {
        if (kind !== 'data') {
          thisTrack.stop();
        }
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        return completeRoom(sid);
      });

      it('should raise "unsubscribed" events on the corresponding RemoteParticipant\'s RemoteTrackPublications', async () => {
        const thoseTracks = await waitFor(thosePublicationsUnsubscribed, 'thosePublicationsUnsubscribed');
        assert.deepEqual(thoseTracks, thoseTracksMap.trackUnsubscribed);
      });

      it('should raise a "trackUnpublished" event on the corresponding RemoteParticipant with a RemoteTrackPublication', () => {
        const thoseTrackPublications = thoseTracksMap.trackUnpublished;
        thoseTrackPublications.forEach(thatPublication => assert(thatPublication instanceof {
          audio: RemoteAudioTrackPublication,
          data: RemoteDataTrackPublication,
          video: RemoteVideoTrackPublication
        }[kind]));
      });

      ['isTrackEnabled', 'trackName', 'trackSid'].forEach(prop => {
        it(`should set the RemoteTrackPublication's .${prop} to the LocalTrackPublication's .${prop}`, () => {
          const thoseTrackPublications = thoseTracksMap.trackUnpublished;
          thoseTrackPublications.forEach(thatPublication => assert.equal(thatPublication[prop], thisLocalTrackPublication[prop]));
        });
      });

      it('should raise a "trackUnsubscribed" event on the corresponding RemoteParticipants with a RemoteTrack', () => {
        const thoseTracks = thoseTracksMap.trackUnsubscribed;
        thoseTracks.forEach(thatTrack => assert(thatTrack instanceof {
          audio: RemoteAudioTrack,
          video: RemoteVideoTrack,
          data: RemoteDataTrack
        }[thatTrack.kind]));
      });

      describe('should raise a "trackUnsubscribed" event on the corresponding RemoteParticipants with a RemoteTrack and', () => {
        it('should set the RemoteTrack\'s .sid to the LocalTrackPublication\'s .trackSid', () => {
          const thoseTracks = thoseTracksMap.trackUnsubscribed;
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.sid, thisLocalTrackPublication.trackSid));
        });

        it(`should set each RemoteTrack's .kind to "${kind}"`, () => {
          const thoseTracks = thoseTracksMap.trackUnsubscribed;
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
        });

        if (kind !== 'data') {
          it(`should set each RemoteTrack's .isEnabled state to ${isEnabled}`, () => {
            const thoseTracks = thoseTracksMap.trackUnsubscribed;
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
          });
        }
      });
    });
  });

  // eslint-disable-next-line no-warning-comments
  // TODO: enable these tests when track_priority MSP is available in prod
  (defaults.topology === 'peer-to-peer' ? describe.skip : describe)('#setPriority', function() {
    // eslint-disable-next-line no-invalid-this
    describe('three participant tests', () => {
      let thisRoom;
      let thoseRooms;
      let aliceRoom;
      let bobRoom;
      let aliceLocal;
      let bobLocal;
      let aliceRemote;
      let bobRemote;
      let aliceTracks;
      let bobTracks;
      let aliceRemoteVideoTrack;
      let bobRemoteVideoTrack;
      let aliceLocalVideoTrackPublication;
      let bobLocalVideoTrackPublication;
      let aliceRemoteVideoTrackPublication;
      let bobRemoteVideoTrackPublication;

      beforeEach(async () => {
        const dataTrack = new LocalDataTrack();
        [, thisRoom, thoseRooms] = await setup({
          testOptions: {
            bandwidthProfile: {
              video: { maxTracks: 1, dominantSpeakerPriority: 'low' }
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

        [aliceRoom, bobRoom] = thoseRooms;
        [aliceLocal, bobLocal] = [aliceRoom, bobRoom].map(room => room.localParticipant);
        [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

        // Alice publishes her tracks at low priority
        // Bob publishes his tracks at standard priority
        await waitFor([
          ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
          ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
          tracksSubscribed(aliceRemote, 3),
          tracksSubscribed(bobRemote, 3)
        ], 'tracks to get published and subscribed');

        [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
          return [...videoTracks.values()][0].track;
        });

        [aliceLocalVideoTrackPublication, bobLocalVideoTrackPublication] = [aliceLocal, bobLocal].map(({ videoTracks }) => {
          return [...videoTracks.values()][0];
        });

        [aliceRemoteVideoTrackPublication, bobRemoteVideoTrackPublication] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
          return [...videoTracks.values()][0];
        });

      });

      afterEach(async () => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        [...aliceTracks, ...bobTracks].forEach(track => track.stop && track.stop());
        if (thisRoom) {
          await completeRoom(thisRoom.sid);
        }
      });

      it('publisher can upgrade track\'s priority', async () => {
        await waitFor([
          trackSwitchedOn(bobRemoteVideoTrack),
          trackSwitchedOff(aliceRemoteVideoTrack)
        ], 'Bobs track to get switched On, and Alice Switched Off');

        // Alice changes her track priority to high
        aliceLocalVideoTrackPublication.setPriority(PRIORITY_HIGH);
        assert.equal(aliceLocalVideoTrackPublication.priority, PRIORITY_HIGH);

        // track priority change event's should fire on
        // 1. RemoteTrackPublication
        const p1 = new Promise(resolve => aliceRemoteVideoTrackPublication.once('publishPriorityChanged', priority => {
          assert.equal(priority, PRIORITY_HIGH);
          resolve();
        }));

        // 2. RemoteParticipant
        const p2 = new Promise(resolve => aliceRemote.once('trackPublishPriorityChanged', (priority, trackPublication) => {
          assert.equal(priority, PRIORITY_HIGH);
          assert.equal(trackPublication, aliceRemoteVideoTrackPublication);
          resolve();
        }));

        // 3. Room
        const p3 = new Promise(resolve => thisRoom.once('trackPublishPriorityChanged', (priority, trackPublication, participant) => {
          assert.equal(priority, PRIORITY_HIGH);
          assert.equal(trackPublication, aliceRemoteVideoTrackPublication);
          assert.equal(participant, aliceRemote);
          resolve();
        }));

        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          waitFor(trackSwitchedOn(aliceRemoteVideoTrack), 'Alice\'s track to switch on'),
          waitFor(trackSwitchedOff(bobRemoteVideoTrack), 'Bob\'s track to get switched off'),
        ], 'Alice track to get switched On, and Bob Switched Off');

        await waitFor([p1, p2, p3], 'receive the trackPublishPriorityChanged on publication, participant and room.');
        assert.equal(aliceRemoteVideoTrackPublication.publishPriority, PRIORITY_HIGH);
      });

      it('publisher can downgrade track\'s priority', async () => {
        await waitFor([
          trackSwitchedOn(bobRemoteVideoTrack),
          trackSwitchedOff(aliceRemoteVideoTrack)
        ], 'Bobs track to get switched On, and Alice Switched Off');

        // Bob changes his track priority to low
        bobLocalVideoTrackPublication.setPriority(PRIORITY_LOW);
        assert.equal(bobLocalVideoTrackPublication.priority, PRIORITY_LOW);

        // track priority change event should fire on
        // 1. RemoteTrackPublication
        const p1 = new Promise(resolve => bobRemoteVideoTrackPublication.once('publishPriorityChanged', priority => {
          assert.equal(priority, PRIORITY_LOW);
          resolve();
        }));

        // 2. RemoteParticipant
        const p2 = new Promise(resolve => bobRemote.once('trackPublishPriorityChanged', (priority, trackPublication) => {
          assert.equal(priority, PRIORITY_LOW);
          assert.equal(trackPublication, bobRemoteVideoTrackPublication);
          resolve();
        }));

        // 3. Room
        const p3 = new Promise(resolve => thisRoom.once('trackPublishPriorityChanged', (priority, trackPublication, participant) => {
          assert.equal(priority, PRIORITY_LOW);
          assert.equal(trackPublication, bobRemoteVideoTrackPublication);
          assert.equal(participant, bobRemote);
          resolve();
        }));

        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          waitFor(trackSwitchedOn(aliceRemoteVideoTrack), `Alice's track to switched on: ${thisRoom.sid}`),
          waitFor(trackSwitchedOff(bobRemoteVideoTrack), `Bob's track to get switched off:' ${thisRoom.sid}`),
        ], 'Alice track to get switched On, and Bob Switched Off');

        await waitFor([p1, p2, p3], `receive the trackPublishPriorityChanged on publication, participant and room: ${thisRoom.sid}`);
        assert.equal(bobRemoteVideoTrackPublication.publishPriority, PRIORITY_LOW);
      });
    });


    [PRIORITY_LOW, PRIORITY_STANDARD, PRIORITY_HIGH].forEach(beforePriority => {
      [PRIORITY_LOW, PRIORITY_STANDARD, PRIORITY_HIGH].forEach(afterPriority => {
        const expectNotification = beforePriority !== afterPriority;
        it(`VMS-2231:subscriber ${expectNotification ? 'gets notified' : 'does not get notified'} when publisher changes priority: ${beforePriority} => ${afterPriority}`, async () => {
          const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
            aliceOptions: {
              bandwidthProfile: {
                video: { maxTracks: 1, dominantSpeakerPriority: 'low' }
              },
              tracks: []
            },
            bobOptions: { tracks: [] },
          });

          const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

          // Bob publishes video trackA with standard priority, trackB with low priority.
          const trackAPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackA, { priority: beforePriority }), `Bob to publish video trackA: ${roomSid}`);
          assert.equal(trackAPubLocal.priority, beforePriority);

          await waitFor(tracksSubscribed(bobRemote, 1), `alice to subscribe to Bobs track: ${roomSid}`);

          const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);
          assert(trackAPubRemote);

          const priorityChangePromise = new Promise(resolve => trackAPubRemote.once('publishPriorityChanged', priority => {
            assert.equal(priority, afterPriority);
            resolve();
          }));

          // initially Alice sees priority as beforePriority.
          assert.equal(trackAPubRemote.publishPriority, beforePriority);

          // Bob updates trackB => afterPriority
          trackAPubLocal.setPriority(afterPriority);
          assert.equal(trackAPubLocal.priority, afterPriority);

          if (expectNotification) {
            // Alice should receive publishPriorityChanged.
            await waitFor(priorityChangePromise, `Alice to receive publishPriorityChanged(${afterPriority}) notification: ${roomSid}`);
          } else {
            // Alice should not receive publishPriorityChanged.
            await waitForNot(priorityChangePromise, `Alice received unexpected publishPriorityChanged(${afterPriority}) notification: ${roomSid}`);
          }

          // later Alice sees priority as afterPriority.
          assert.equal(trackAPubRemote.publishPriority, afterPriority);

          aliceRoom.disconnect();
          bobRoom.disconnect();
        });
      });
    });

    it('publisher can upgrade and downgrade track priorities', async () => {
      // Alice and Bob join without tracks, Alice has maxTracks property set to 1
      const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
        aliceOptions: {
          bandwidthProfile: {
            video: { maxTracks: 1, dominantSpeakerPriority: 'low' }
          },
          tracks: []
        },
        bobOptions: { tracks: [] },
      });

      const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

      // workaround for JSDK-2573: race condition - video SDK recycles transceivers that is in use.
      await new Promise(resolve => setTimeout(resolve, 1000));

      const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));

      // Bob publishes video trackA with standard priority, trackB with low priority.
      const trackAPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackA, { priority: PRIORITY_STANDARD }), `Bob to publish video trackA: ${roomSid}`);
      const trackBPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackB, { priority: PRIORITY_LOW }), `Bob to publish video trackB: ${roomSid}`);
      assert.equal(trackAPubLocal.priority, PRIORITY_STANDARD);
      assert.equal(trackBPubLocal.priority, PRIORITY_LOW);

      // wait for alice to subscribe two tracks
      await waitFor(tracksSubscribed(bobRemote, 2), `wait for alice to subscribe to Bobs tracks: ${roomSid}`);

      const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);
      assert(trackAPubRemote);
      const trackBPubRemote = bobRemote.videoTracks.get(trackBPubLocal.trackSid);
      assert(trackBPubRemote);

      await waitFor([
        trackSwitchedOn(trackAPubRemote.track),
        trackSwitchedOff(trackBPubRemote.track)
      ], `Step 1] trackA=On, trackB=Off: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_LOW);

      // Bob updates trackB => PRIORITY_HIGH
      trackBPubLocal.setPriority(PRIORITY_HIGH);
      assert.equal(trackBPubLocal.priority, PRIORITY_HIGH);

      await waitFor([
        trackSwitchedOn(trackBPubRemote.track),
        trackSwitchedOff(trackAPubRemote.track)
      ], `Step 2] trackA=Off, trackB=On: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_HIGH);

      // Bob updates trackB => PRIORITY_LOW
      trackBPubLocal.setPriority(PRIORITY_LOW);
      assert.equal(trackBPubLocal.priority, PRIORITY_LOW);

      await waitFor([
        trackSwitchedOn(trackAPubRemote.track),
        trackSwitchedOff(trackBPubRemote.track)
      ], `Step 3] trackA=On, trackB=Off: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_LOW);

      aliceRoom.disconnect();
      bobRoom.disconnect();
    });
  });
});
