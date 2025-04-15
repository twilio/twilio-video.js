'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../../es5');

const LocalTrackPublication = require('../../../../es5/media/track/localtrackpublication');
const RemoteAudioTrack = require('../../../../es5/media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('../../../../es5/media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('../../../../es5/media/track/remotedatatrack');
const RemoteDataTrackPublication = require('../../../../es5/media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('../../../../es5/media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('../../../../es5/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../../es5/util');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../../es5/util/constants');
const { TrackNameIsDuplicatedError, TrackNameTooLongError } = require('../../../../es5/util/twilio-video-errors');

const defaults = require('../../../lib/defaults');
const { isFirefox, isSafari } = require('../../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  randomName,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
  tracksUnpublished,
  waitFor,
  waitForSometime,
  waitForTracks
} = require('../../../lib/util');

describe('LocalParticipant: publishUnpublishTrack', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('#publishTrack', function() {
    // eslint-disable-next-line no-invalid-this
    this.retries(2);

    let room;
    let sid;
    let trackPublications = [];
    let tracks;

    async function setup() {
      sid = await createRoom(name, defaults.topology);
      const options = Object.assign({ name: sid, tracks: [] }, defaults);
      const token = getToken(randomName());
      [room, tracks] = await waitFor([
        connect(token, options),
        createLocalTracks({ audio: true, video: smallVideoConstraints })
      ], 'connect and create local tracks');
      tracks.push(new LocalDataTrack());
    }

    [
      [
        'when three LocalTracks (audio, video, and data) are published sequentially',
        async () => {
          trackPublications = [
            await room.localParticipant.publishTrack(tracks[0]),
            await room.localParticipant.publishTrack(tracks[1]),
            await room.localParticipant.publishTrack(tracks[2])
          ];
        }
      ],
      [
        'when three LocalTracks (audio, video, and data) are published together',
        async () => {
          trackPublications = await waitFor(tracks.map(track => {
            return room.localParticipant.publishTrack(track);
          }), 'publish tracks');
        }
      ]
    ].forEach(([ctx, publish]) => {
      context(ctx, () => {
        before(async () => {
          await waitFor(setup(), 'setup');
          await waitFor(publish(), 'publish');
        });

        it('should return LocalTrackPublications for each LocalTrack', () => {
          trackPublications.forEach((localTrackPublication, i) => {
            const track = tracks[i];
            assert(localTrackPublication instanceof LocalTrackPublication);
            assert.equal(localTrackPublication.track, track);
            assert(localTrackPublication.trackSid.match(/^MT[a-f0-9]{32}$/));
          });
        });

        it('should add each of the LocalTracks to the LocalParticipant\'s ._tracks and their respective kinds\' collections', () => {
          tracks.forEach(track => {
            assert.equal(room.localParticipant._tracks.get(track.id), track);
            assert.equal(room.localParticipant[`_${track.kind}Tracks`].get(track.id), track);
          });
        });

        it('should add each of the LocalTrackPublications to the LocalParticipant\'s .tracks and their respective kinds\' collections', () => {
          trackPublications.forEach(trackPublication => {
            assert.equal(room.localParticipant.tracks.get(trackPublication.trackSid), trackPublication);
            assert.equal(room.localParticipant[`${trackPublication.track.kind}Tracks`].get(trackPublication.trackSid), trackPublication);
          });
        });

        after(() => {
          trackPublications = [];
          tracks.splice(0).forEach(track => track.kind !== 'data' && track.stop());
          if (room) {
            room.disconnect();
          }
          return completeRoom(sid);
        });
      });
    });

    context('when a LocalTrack is published to two Rooms', function()  {
      // eslint-disable-next-line no-invalid-this
      this.retries(2);

      let anotherRoom;
      let anotherSid;

      before(async () => {
        anotherSid =  await createRoom(randomName(), defaults.topology);
        const options = Object.assign({ name: anotherSid, tracks: [] }, defaults);
        const token = getToken(randomName());
        [anotherRoom] = await waitFor([
          connect(token, options),
          setup()
        ], 'connect and setup');

        trackPublications = await waitFor([
          room.localParticipant.publishTrack(tracks[0], { priority: PRIORITY_LOW }),
          anotherRoom.localParticipant.publishTrack(tracks[0], { priority: PRIORITY_HIGH })
        ], 'publish tracks');
      });

      it('should add the LocalTrack to the LocalParticipant\'s ._tracks in both Rooms', () => {
        assert.equal(room.localParticipant._tracks.get(tracks[0].id), tracks[0]);
        assert.equal(anotherRoom.localParticipant._tracks.get(tracks[0].id), tracks[0]);
      });

      it('should create two different LocalTrackPublications', () => {
        assert(trackPublications[0] instanceof LocalTrackPublication);
        assert(trackPublications[1] instanceof LocalTrackPublication);
        assert.notEqual(trackPublications[0], trackPublications[1]);
      });

      it('should add each LocalTrackPublication to its corresponding Room\'s LocalParticipant .tracks', () => {
        const localTrackPublication1 = [...room.localParticipant.tracks.values()].find(
          localTrackPublication => localTrackPublication.track === tracks[0]);
        const localTrackPublication2 = [...anotherRoom.localParticipant.tracks.values()].find(
          localTrackPublication => localTrackPublication.track === tracks[0]);
        assert.equal(localTrackPublication1.track, tracks[0]);
        assert.equal(localTrackPublication2.track, tracks[0]);
      });

      it('should assign different SIDs to the two LocalTrackPublications', () => {
        assert.notEqual(trackPublications[0].trackSid, trackPublications[1].trackSid);
      });

      it('should set the appropriate priority values to the two LocalTrackPublications', () => {
        const localTrackPublication1 = [...room.localParticipant.tracks.values()].find(
          localTrackPublication => localTrackPublication.track === tracks[0]);
        const localTrackPublication2 = [...anotherRoom.localParticipant.tracks.values()].find(
          localTrackPublication => localTrackPublication.track === tracks[0]);
        assert.equal(localTrackPublication1.priority, PRIORITY_LOW);
        assert.equal(localTrackPublication2.priority, PRIORITY_HIGH);
      });

      after(() => {
        trackPublications = [];
        tracks.splice(0).forEach(track => track.kind !== 'data' && track.stop());
        [anotherRoom, room].forEach(room => room && room.disconnect());
        return Promise.all([anotherSid, sid].map(completeRoom));
      });
    });

    context('when the Room disconnects while a LocalTrack is being published', () => {
      before(setup);

      it('should reject the Promise returned by LocalParticipant#publishTrack with an Error', async () => {
        try {
          const promise = room.localParticipant.publishTrack(tracks[0]);
          room.disconnect();
          await promise;
        } catch (error) {
          assert.equal(error.message, 'LocalParticipant disconnected');
          return;
        }
        throw new Error('Unexpected resolution');
      });

      after(() => {
        trackPublications = [];
        tracks.splice(0).forEach(track => track.kind !== 'data' && track.stop());
        return completeRoom(sid);
      });
    });

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
        [true, false],
        x => `with${x ? '' : 'out'} a name for the LocalTrack`
      ],
      [
        [undefined, PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD],
        x => `with${x ? ` priority "${x}"` : 'out specifying a priority'}`
      ],
      [
        ['never', 'previously'],
        x => `that has ${x} been published`
      ]
    ], ([isEnabled, kind, withName, priority, when]) => {
      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Enable this scenario for Firefox when the following
      // bug is fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=1526253
      if (isFirefox && kind === 'data' && when === 'previously') {
        return;
      }

      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Until we find out why Travis is failing tests due
      // to not being able to create enough RTCPeerConnections, we will enable
      // testing for only when priority is set to "high". (JSDK-2417)
      if (priority !== PRIORITY_HIGH) {
        return;
      }

      let thisRoom;
      let thisParticipant;
      let thisLocalTrackPublication;
      let thisTrack;
      let thoseRooms;
      let thoseTracksBefore;
      let thoseTracksPublished;
      let thoseTracksSubscribed;
      let thoseTracksMap;

      const localTrackNameByKind = {
        audio: 'foo',
        video: 'bar',
        data: 'baz'
      }[kind];

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);
        const identities = ['Alice', 'Bob', 'Charlie'];
        const options = Object.assign({ name: sid }, defaults);
        const localTrackOptions = Object.assign(
          withName
            ? { name: localTrackNameByKind }
            : {},
          smallVideoConstraints);

        thisTrack = await {
          audio: createLocalAudioTrack,
          video: createLocalVideoTrack,
          data() { return new LocalDataTrack(); }
        }[kind](localTrackOptions);

        // eslint-disable-next-line no-warning-comments
        // TODO(mroberts): Really this test needs to be refactored so that only
        // the LocalAudio- and LocalVideo-Track tests test the enable/disable
        // functionality.
        if (kind !== 'data') {
          thisTrack.enable(isEnabled);
        }

        const tracks = when === 'previously'
          ? [thisTrack]
          : [];

        const thisIdentity = identities[0];
        const thisToken = getToken(thisIdentity);
        const theseOptions = Object.assign({ tracks }, options);
        thisRoom = await connect(thisToken, theseOptions);
        thisParticipant = thisRoom.localParticipant;
        await waitFor(tracksPublished(thisParticipant, tracks.length), `tracksPublished: ${sid}`);

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);

        thoseRooms = await waitFor(thoseTokens.map(thatToken => {
          return connect(thatToken, thoseOptions);
        }), `Rooms to connect: ${sid}`);

        await waitFor([thisRoom].concat(thoseRooms).map(room => {
          return participantsConnected(room, identities.length - 1);
        }), `all Participants to connect: ${sid}`);

        const [aliceInBobRoom, aliceInCharlieRoom] = thoseRooms.map(thatRoom => {
          return thatRoom.participants.get(thisParticipant.sid);
        });

        await waitFor([aliceInBobRoom, aliceInCharlieRoom].map(thatParticipant => {
          return tracksSubscribed(thatParticipant, tracks.length);
        }), `tracksSubscribed: ${sid}`);

        thoseTracksBefore = flatMap([aliceInBobRoom, aliceInCharlieRoom], thatParticipant => {
          return [...thatParticipant._tracks.values()];
        });

        if (when === 'previously') {
          thisParticipant.unpublishTrack(thisTrack);

          await waitFor([aliceInBobRoom, aliceInCharlieRoom].map(thatParticipant => {
            return tracksUnpublished(thatParticipant, tracks.length);
          }), `tracksUnpublished: ${sid}`);

          // NOTE(mmalavalli): Even though the "trackUnpublished" events are
          // fired on the RemoteParticipants, we need to make sure that the
          // SDP negotiation is complete before we re-publish the LocalTrack.
          // Therefore we wait for 4 seconds.
          await waitForSometime(4000);
        }

        const thisLocalTrackPublicationPromise = priority ? thisParticipant.publishTrack(thisTrack, { priority }) : thisParticipant.publishTrack(thisTrack);
        const thoseTracksPublishedPromise = [aliceInBobRoom, aliceInCharlieRoom].map(thatParticipant => waitForTracks('trackPublished', thatParticipant, 1));
        const thoseTracksSubscribedPromise = [aliceInBobRoom, aliceInCharlieRoom].map(thatParticipant => waitForTracks('trackSubscribed', thatParticipant, 1));

        thisLocalTrackPublication = await waitFor(thisLocalTrackPublicationPromise, `Track to publish: ${sid}`);
        thoseTracksPublished = await waitFor(thoseTracksPublishedPromise, `Participants to receive trackPublished: ${sid}`);
        thoseTracksSubscribed = await waitFor(thoseTracksSubscribedPromise, `Participants to receive trackSubscribed: ${sid}`);

        thoseTracksPublished = flatMap(thoseTracksPublished);
        thoseTracksSubscribed = flatMap(thoseTracksSubscribed);

        thoseTracksMap = {
          trackPublished: thoseTracksPublished,
          trackSubscribed: thoseTracksSubscribed
        };
      });

      after(() => {
        if (kind !== 'data') {
          thisTrack.stop();
        }
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        return completeRoom(sid);
      });

      it('should raise a "trackPublished" event on the corresponding RemoteParticipant with a RemoteTrackPublication', () => {
        const thoseTrackPublications = thoseTracksMap.trackPublished;
        thoseTrackPublications.forEach(thatPublication => assert(thatPublication instanceof {
          audio: RemoteAudioTrackPublication,
          data: RemoteDataTrackPublication,
          video: RemoteVideoTrackPublication
        }[kind]));
      });

      ['isTrackEnabled', ['publishPriority', 'priority'], 'trackName', 'trackSid'].forEach(propOrPropPair => {
        const [remoteProp, localProp] = Array.isArray(propOrPropPair) ? propOrPropPair : [propOrPropPair, propOrPropPair];
        it(`should set the RemoteTrackPublication's .${remoteProp} to the LocalTrackPublication's .${localProp}`, () => {
          const thoseTrackPublications = thoseTracksMap.trackPublished;
          thoseTrackPublications.forEach(thatPublication => assert.equal(thatPublication[remoteProp], thisLocalTrackPublication[localProp]));
        });
      });

      it('should raise a "trackSubscribed" event on the corresponding RemoteParticipants with a RemoteTrack', () => {
        const thoseTracks = thoseTracksMap.trackSubscribed;
        thoseTracks.forEach(thatTrack => assert(thatTrack instanceof {
          audio: RemoteAudioTrack,
          video: RemoteVideoTrack,
          data: RemoteDataTrack
        }[thatTrack.kind]));
      });

      describe('should raise a "trackSubscribed" event on the corresponding RemoteParticipants with a RemoteTrack and', () => {
        it('should set the RemoteTrack\'s .sid to the LocalTrackPublication\'s .trackSid', () => {
          const thoseTracks = thoseTracksMap.trackSubscribed;
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.sid, thisLocalTrackPublication.trackSid));
        });

        it(`should set each RemoteTrack's .kind to "${kind}"`, () => {
          const thoseTracks = thoseTracksMap.trackSubscribed;
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
        });

        it('should set each RemoteTrack\'s .name to the LocalTrackPublication\'s .trackName', () => {
          const thoseTracks = thoseTracksMap.trackSubscribed;
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.name, thisLocalTrackPublication.trackName));
        });

        if (kind === 'data') {
          ['string', 'arraybuffer'].forEach(dataType => {
            it(`should transmit any ${dataType} data sent through the LocalDataTrack to the Room to each RemoteDataTrack`, async () => {
              const data = dataType === 'string' ? 'foo' : new Uint32Array([1, 2, 3]);
              const thoseTracks = thoseTracksMap.trackSubscribed;
              const thoseTracksReceivedData = thoseTracks.map(track => new Promise(resolve => track.once('message', resolve)));
              const dataChannelSendInterval = setInterval(() => thisTrack.send(dataType === 'string' ? data : data.buffer), 1000);
              const receivedData = await waitFor(thoseTracksReceivedData, 'thoseTracksReceivedData');
              clearInterval(dataChannelSendInterval);
              receivedData.forEach(item => dataType === 'string' ? assert.equal(item, data) : assert.deepEqual(new Uint32Array(item), data));
            });
          });
        } else {
          it(`should set each RemoteTrack's .isEnabled state to ${isEnabled}`, () => {
            const thoseTracks = thoseTracksMap.trackSubscribed;
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
          });
        }

        if (when === 'previously') {
          it('the RemoteTrack should be a new RemoteTrack instance', () => {
            const thoseTracks = thoseTracksMap.trackSubscribed;
            assert.equal(thoseTracksBefore.length, thoseTracks.length);
            thoseTracksBefore.forEach((thatTrackBefore, i) => {
              const thatTrackAfter = thoseTracks[i];
              if (!isFirefox && !isSafari) {
                assert.notEqual(thatTrackAfter.sid, thatTrackBefore.sid);
              }
              assert.equal(thatTrackAfter.kind, thatTrackBefore.kind);
              assert.equal(thatTrackAfter.enabled, thatTrackBefore.enabled);
              assert.notEqual(thatTrackAfter, thatTrackBefore);
            });
          });
        }
      });
    });

    // NOTE(mroberts): Waiting on a Group Rooms deploy.
    describe('"trackPublicationFailed" event', () => {
      combinationContext([
        [
          [
            {
              createLocalTrack() {
                const { name } = tracks.find(track => track.kind === 'audio');
                return createLocalAudioTrack({ name });
              },
              scenario: 'a LocalTrack whose name is the same as one of the currently published LocalTracks',
              TwilioError: TrackNameIsDuplicatedError
            },
            {
              createLocalTrack() {
                const name = '0'.repeat(129);
                return createLocalAudioTrack({ name });
              },
              scenario: 'a LocalTrack whose name is too long',
              TwilioError: TrackNameTooLongError
            }
          ],
          ({ scenario }) => `called with ${scenario}`
        ]
      ], ([{ createLocalTrack, scenario, TwilioError }]) => {
        // eslint-disable-next-line no-void
        void scenario;

        let track;
        let trackPublicationFailed;

        before(async () => {
          await setup();
          await room.localParticipant.publishTracks(tracks);
          track = await createLocalTrack();
          try {
            await room.localParticipant.publishTrack(track);
          } catch (error) {
            trackPublicationFailed = error;
            return;
          }
          throw new Error('Unexpected publication');
        });

        it(`should emit "trackPublicationFailed" on the Room's LocalParticipant with a ${TwilioError.name}`, () => {
          assert(trackPublicationFailed instanceof TwilioError);
        });

        it(`should reject the Promise returned by LocalParticipant#publishTrack with a ${TwilioError.name}`, () => {
          assert(trackPublicationFailed instanceof TwilioError);
        });

        after(() => {
          track.stop();
          tracks.splice(0).forEach(track => track.stop && track.stop());
          if (room) {
            room.disconnect();
          }
          return completeRoom(sid);
        });
      });
    });
  });

  describe('#unpublishTrack', function() {
    // eslint-disable-next-line no-invalid-this
    this.retries(2);

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
      let thisLocalTrackPublication;
      let thisTrack;
      let thoseRooms;
      let thosePublicationsUnsubscribed;
      let thoseTracksUnpublished;
      let thoseTracksUnsubscribed;
      let thoseTracksMap;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);
        const identities = ['Alice', 'Bob', 'Charlie'];
        const options = Object.assign({ name: sid }, defaults);

        thisTrack = await {
          audio: createLocalAudioTrack,
          video() { return createLocalVideoTrack(smallVideoConstraints); },
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
        const alice  = thisRoom.localParticipant;
        await tracksPublished(alice, tracks.length);

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);

        const [bobRoom, charlieRoom] = await waitFor(thoseTokens.map(thatToken => {
          return connect(thatToken, thoseOptions);
        }), `Rooms to get connected: ${sid}`);
        thoseRooms = [bobRoom, charlieRoom];

        await waitFor([thisRoom, bobRoom, charlieRoom].map(room => {
          return participantsConnected(room, identities.length - 1);
        }), `all Participants to get connected: ${sid}`);

        const [aliceInBobRoom, aliceInCharlieRoom] = [bobRoom, charlieRoom].map(thatRoom => {
          return thatRoom.participants.get(alice.sid);
        });

        const bobSubscribes =  tracksSubscribed(aliceInBobRoom, tracks.length);
        const charlieSubscribes =  tracksSubscribed(aliceInCharlieRoom, tracks.length);

        await waitFor(bobSubscribes, `Bob to subscribe Alice's track: ${sid}`);
        await waitFor(charlieSubscribes, `Charlie to subscribe Alice's track: ${sid}`);

        if (when !== 'published') {
          alice.unpublishTrack(thisTrack);

          const bobSeesUnpublished =  tracksUnpublished(aliceInBobRoom, tracks.length - 1);
          const charlieSeesUnpublished =  tracksUnpublished(aliceInCharlieRoom, tracks.length - 1);

          await waitFor(bobSeesUnpublished, `Bob to see track getting Unpublished: ${sid}`);
          await waitFor(charlieSeesUnpublished, `Charlie to see track getting Unpublished: ${sid}`);

          // NOTE(mmalavalli): Even though the "trackUnpublished" events are
          // fired on the RemoteParticipants, we need to make sure that the
          // SDP negotiation is complete before we re-publish the LocalTrack.
          // Therefore we wait for 4 seconds.
          await waitForSometime(4000);

          await waitFor(alice.publishTrack(thisTrack), `Track to get re-published: ${sid}`);

          const bobSubscribesAgain =  tracksSubscribed(aliceInBobRoom, tracks.length);
          const charlieSubscribesAgain =  tracksSubscribed(aliceInCharlieRoom, tracks.length);

          await waitFor(bobSubscribesAgain, `Bob to subscribe Alice's track again: ${sid}`);
          await waitFor(charlieSubscribesAgain, `Charlie to subscribe Alice's track again: ${sid}`);
        }

        thisLocalTrackPublication = alice.unpublishTrack(thisTrack);

        thosePublicationsUnsubscribed = flatMap([aliceInBobRoom, aliceInCharlieRoom], participant => [...participant.tracks.values()]).map(publication => {
          return new Promise(resolve => publication.once('unsubscribed', resolve));
        });

        [thoseTracksUnsubscribed, thoseTracksUnpublished] = await waitFor([
          'trackUnsubscribed',
          'trackUnpublished'
        ].map(event => {
          return Promise.all([aliceInBobRoom, aliceInCharlieRoom].map(async thatParticipant => {
            const [trackOrPublication] = await waitForTracks(event, thatParticipant, 1);
            return trackOrPublication;
          }));
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
});
