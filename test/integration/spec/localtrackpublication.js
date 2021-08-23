'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../es5');

const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../es5/util/constants');
const RemoteAudioTrack = require('../../../es5/media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('../../../es5/media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('../../../es5/media/track/remotedatatrack');
const RemoteDataTrackPublication = require('../../../es5/media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('../../../es5/media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('../../../es5/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../es5/util');
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
  tracksPublished,
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

  it('JSDK-2583 late arrivals see stale priority for the tracks', async () => {
    const roomSid = await createRoom(randomName(), defaults.topology);
    const options = Object.assign({ name: roomSid }, defaults);

    // BOB joins a room
    const bobRoom = await connect(getToken('Bob'), Object.assign({ tracks: [] }, options));

    // Bob publishes a track at low priority.
    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    const trackAPubLocal = await waitFor(bobRoom.localParticipant.publishTrack(bobVideoTrackA, { priority: PRIORITY_LOW }), `Bob to publish video trackA: ${roomSid}`, 20000, true);

    // Bob updates trackA => PRIORITY_HIGH
    trackAPubLocal.setPriority(PRIORITY_HIGH);
    assert.equal(trackAPubLocal.priority, PRIORITY_HIGH);

    // Alice joins a room after 5 seconds.
    await waitForSometime(5000);
    const aliceRoom = await connect(getToken('Alice'), Object.assign({ tracks: [] }, options));
    const bobRemote = aliceRoom.participants.get(bobRoom.localParticipant.sid);

    // Alice sees bob track.
    await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`, 20000, true);
    const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);

    const trackPriorityChanged = new Promise(resolve => trackAPubRemote.once('publishPriorityChanged', priority => {
      assert.equal(priority, PRIORITY_HIGH);
      resolve();
    }));

    // alice waits for 5 seconds or for trackPriorityChanged to have been fired.
    await Promise.race([waitForSometime(5000), trackPriorityChanged]);

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

  [true, false].forEach(trackInitiallyEnabled => {
    it(`JSDK-2603: ${trackInitiallyEnabled ? 'trackEnabled' : 'trackDisabled'} should fire only on change`, async () => {
      const roomSid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: roomSid }, defaults);

      // Alice joins a room
      const aliceRoom = await connect(getToken('Alice'), Object.assign({ tracks: [] }, options));

      // Alice adds listener for the track Enabled/Disabled events.
      const trackDisabledPromise = waitOnceForRoomEvent(aliceRoom, 'trackDisabled');
      const trackEnabledPromise = waitOnceForRoomEvent(aliceRoom, 'trackEnabled');
      const trackStateChanged = Promise.race([trackDisabledPromise, trackEnabledPromise]);

      // Bob joins the room
      const bobLocalAudioTrack = await createLocalAudioTrack({ fake: true });

      if (trackInitiallyEnabled) {
        bobLocalAudioTrack.enable();
      } else {
        bobLocalAudioTrack.disable();
      }

      const bobRoom = await connect(getToken('Bob'), Object.assign({ tracks: [bobLocalAudioTrack] }, options));

      // wait for sometime to ensure that neither event fire.
      await waitForNot(trackStateChanged, `Alice received unexpected trackEnabled/Disabled event: ${roomSid}`);

      if (trackInitiallyEnabled) {
        bobLocalAudioTrack.disable();
        await waitFor(trackDisabledPromise, `Alice to receive trackDisabled event: ${roomSid}`);

        bobLocalAudioTrack.enable();
        await waitFor(trackEnabledPromise, `Alice to receive trackEnabled event: ${roomSid}`);
      } else {
        bobLocalAudioTrack.enable();
        await waitFor(trackEnabledPromise, `Alice to receive trackEnabled event: ${roomSid}`);

        bobLocalAudioTrack.disable();
        await waitFor(trackDisabledPromise, `Alice to receive trackDisabled event: ${roomSid}`);
      }

      [aliceRoom, bobRoom].forEach(room => room.disconnect());
      return completeRoom(roomSid);
    });
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
      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Disabling DataTracks for Firefox P2P due to this
      // bug: JSDK-2630. Re-enable once fixed.
      if (isFirefox && kind === 'data' && (when !== 'published' || defaults.topology === 'peer-to-peer')) {
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
        await tracksPublished(thisParticipant, tracks.length);

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);

        thoseRooms = await waitFor(thoseTokens.map(thatToken => {
          return connect(thatToken, thoseOptions);
        }), `Rooms to connect: ${sid}`);

        await waitFor([thisRoom].concat(thoseRooms).map(room => {
          return participantsConnected(room, identities.length - 1);
        }), `all Participants to get connected: ${sid}`);

        thoseParticipants = thoseRooms.map(thatRoom => {
          return thatRoom.participants.get(thisParticipant.sid);
        });

        await waitFor(thoseParticipants.map(thatParticipant => {
          return tracksSubscribed(thatParticipant, tracks.length);
        }), `Track to get subscribed: ${sid}`);

        if (when !== 'published') {
          thisParticipant.unpublishTrack(thisTrack);

          await waitFor(thoseParticipants.map(thatParticipant => {
            return tracksUnpublished(thatParticipant, tracks.length - 1);
          }), `Track to get unpublished: ${sid}`);

          // NOTE(mmalavalli): Even though the "trackUnpublished" events are
          // fired on the RemoteParticipants, we need to make sure that the
          // SDP negotiation is complete before we re-publish the LocalTrack.
          // Therefore we wait for 2 seconds.
          await waitForSometime(2000);

          await waitFor(thisParticipant.publishTrack(thisTrack), `Track to get re-published: ${sid}`);

          await waitFor(thoseParticipants.map(thatParticipant => {
            return tracksSubscribed(thatParticipant, tracks.length);
          }), `Tracks to get re-subscribed: ${sid}`);
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
        }), `tracks to get unsubscribed and unpublished: ${sid}`);

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

      async function setupParticipants({ aliceTrackPriority, bobTrackPriority }) {
        const dataTrack = new LocalDataTrack();
        [, thisRoom, thoseRooms] = await setup({
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
          nTracks: 0,
          participantNames: ['Observer', 'Alice', 'Bob']
        });

        [aliceTracks, bobTracks] = await Promise.all(['alice', 'bob'].map(async () => [
          createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
          await createLocalVideoTrack(smallVideoConstraints),
        ]));

        [aliceRoom, bobRoom] = thoseRooms;
        [aliceLocal, bobLocal] = [aliceRoom, bobRoom].map(room => room.localParticipant);
        [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

        // Alice publishes her tracks at aliceTrackPriority
        // Bob publishes his tracks at bobTrackPriority
        await waitFor([
          ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: aliceTrackPriority })),
          ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: bobTrackPriority })),
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
      }

      afterEach(async () => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        [...aliceTracks, ...bobTracks].forEach(track => track.stop && track.stop());
        if (thisRoom) {
          await completeRoom(thisRoom.sid);
        }
      });

      it('publisher can upgrade track\'s priority', async () => {
        await waitFor(setupParticipants({ aliceTrackPriority: PRIORITY_LOW, bobTrackPriority: PRIORITY_STANDARD }), 'Alice publishes at low pri, Bob at standard');
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
        await waitFor(setupParticipants({ aliceTrackPriority: PRIORITY_STANDARD, bobTrackPriority: PRIORITY_HIGH }), 'Alice publishes at standard pri, Bob at high');
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
                video: {
                  maxTracks: 1,
                  dominantSpeakerPriority: 'low'
                }
              },
              tracks: []
            },
            bobOptions: { tracks: [] },
          });

          const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));

          const priorityChangedEventOnRoom = waitOnceForRoomEvent(aliceRoom, 'trackPublishPriorityChanged');

          // Bob publishes video trackA with standard priority, trackB with low priority.
          const trackAPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackA, { priority: beforePriority }), `Bob to publish video trackA: ${roomSid}`);
          assert.equal(trackAPubLocal.priority, beforePriority);

          await waitFor(tracksSubscribed(bobRemote, 1), `alice to subscribe to Bobs track: ${roomSid}`);

          const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);
          assert(trackAPubRemote);

          // initial track publication should not raise priorityChanged event.
          await waitForNot(priorityChangedEventOnRoom, `received unexpected 'trackPublishPriorityChanged' on room: ${roomSid}`);

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
            await waitFor([priorityChangePromise, priorityChangedEventOnRoom], `Alice to receive publishPriorityChanged(${afterPriority}) notification: ${roomSid}`);
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

    it('publisher and subscriber priority changes do not mix up', async () => {
      // Alice and Bob join without tracks, Alice has maxTracks property set to 1
      const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
        aliceOptions: { tracks: [] },
        bobOptions: { tracks: [] },
      });

      // Bob publishes video trackA with low priority
      const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
      const trackAPubLocal = await waitFor(bobLocal.publishTrack(bobVideoTrackA, { priority: PRIORITY_LOW }), `Bob to publish video trackA: ${roomSid}`);
      assert.equal(trackAPubLocal.priority, PRIORITY_LOW);

      // wait for alice to subscribe Bob's track
      await waitFor(tracksSubscribed(bobRemote, 1), `wait for alice to subscribe to Bob's tracks: ${roomSid}`);

      // alice sees publish priority as low.
      const trackAPubRemote = bobRemote.videoTracks.get(trackAPubLocal.trackSid);
      const trackARemote = trackAPubRemote.track;

      assert.equal(trackARemote.priority, null); // subscribe priority of remote track
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_LOW); // publish priority of remote track

      // subscriber priority => high.
      trackARemote.setPriority(PRIORITY_HIGH);
      assert.equal(trackARemote.priority, PRIORITY_HIGH);

      // publish priority => PRIORITY_HIGH
      trackAPubLocal.setPriority(PRIORITY_HIGH);
      assert.equal(trackAPubLocal.priority, PRIORITY_HIGH);

      // alice gets notified of bob's track priority change.
      const trackPriorityChanged = new Promise(resolve => trackAPubRemote.once('publishPriorityChanged', priority => {
        assert.equal(priority, PRIORITY_HIGH);
        resolve();
      }));

      await waitFor(trackPriorityChanged, 'alice to receive publishPriorityChanged');

      assert.equal(trackARemote.priority, PRIORITY_HIGH); // subscribe priority of remote track
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_HIGH); // publish priority of remote track

      // subscriber priority => standard.
      trackARemote.setPriority(PRIORITY_STANDARD);

      assert.equal(trackARemote.priority, PRIORITY_STANDARD); // subscribe priority of remote track
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_HIGH); // publish priority of remote track

      aliceRoom.disconnect();
      bobRoom.disconnect();
    });

    it('publisher can upgrade and downgrade track priorities', async () => {
      // Alice and Bob join without tracks, Alice has maxTracks property set to 1
      const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
        aliceOptions: {
          bandwidthProfile: {
            video: {
              maxTracks: 1,
              dominantSpeakerPriority: 'low'
            }
          },
          tracks: []
        },
        bobOptions: { tracks: [] },
      });

      const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
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
      ], `Step 1] trackA[${trackAPubRemote.track.sid}]=On, trackB[${trackBPubRemote.track.sid}]=Off: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_LOW);

      const trackBPriorityChangedToHigh = new Promise(resolve => trackBPubRemote.once('publishPriorityChanged', priority => {
        assert.equal(priority, PRIORITY_HIGH);
        resolve();
      }));

      // Bob updates trackB => PRIORITY_HIGH
      trackBPubLocal.setPriority(PRIORITY_HIGH);
      assert.equal(trackBPubLocal.priority, PRIORITY_HIGH);

      await waitFor([
        trackSwitchedOn(trackBPubRemote.track),
        trackSwitchedOff(trackAPubRemote.track)
      ], `Step 2] trackA[${trackAPubRemote.track.sid}]=Off, trackB[${trackBPubRemote.track.sid}]=On: ${roomSid}`);

      // wait for trackBPriorityChangedToHigh before checking publishPriority.
      await waitFor(trackBPriorityChangedToHigh, `trackB priority changed to High: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_HIGH);

      const trackBPriorityChangedToLow = new Promise(resolve => trackBPubRemote.once('publishPriorityChanged', priority => {
        assert.equal(priority, PRIORITY_LOW);
        resolve();
      }));

      // Bob updates trackB => PRIORITY_LOW
      trackBPubLocal.setPriority(PRIORITY_LOW);
      assert.equal(trackBPubLocal.priority, PRIORITY_LOW);

      await waitFor([
        trackSwitchedOn(trackAPubRemote.track),
        trackSwitchedOff(trackBPubRemote.track)
      ], `Step 3] trackA[${trackAPubRemote.track.sid}]=On, trackB[${trackBPubRemote.track.sid}]=Off: ${roomSid}`);

      // wait for trackBPriorityChangedToLow before checking publishPriority.
      await waitFor(trackBPriorityChangedToLow, `trackB priority changed to Low: ${roomSid}`);
      assert.equal(trackAPubRemote.publishPriority, PRIORITY_STANDARD);
      assert.equal(trackBPubRemote.publishPriority, PRIORITY_LOW);

      aliceRoom.disconnect();
      bobRoom.disconnect();
    });
  });

  it('JSDK-2573/JSDK-2807 - race condition when recycling transceiver', async () => {
    // Alice and Bob join without tracks
    const { roomSid, aliceRoom, bobRoom, bobLocal, bobRemote } = await setupAliceAndBob({
      aliceOptions: { tracks: [] },
      bobOptions: { tracks: [] },
    });

    const bobVideoTrackA = await createLocalVideoTrack(Object.assign({ name: 'trackA' }, smallVideoConstraints));
    const bobVideoTrackB = await createLocalVideoTrack(Object.assign({ name: 'trackB' }, smallVideoConstraints));

    // Bob publishes video trackA and trackB in quick succession
    await waitFor(bobLocal.publishTrack(bobVideoTrackA), `Bob to publish video trackA: ${roomSid}`);
    await waitFor(bobLocal.publishTrack(bobVideoTrackB), `Bob to publish video trackB: ${roomSid}`);

    // wait for alice to subscribe two tracks
    await waitFor(tracksSubscribed(bobRemote, 2), `wait for alice to subscribe to Bobs tracks: ${roomSid}`);

    aliceRoom.disconnect();
    bobRoom.disconnect();
  });
});
