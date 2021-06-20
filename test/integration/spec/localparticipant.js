'use strict';

const assert = require('assert');
const { DEFAULT_CHROME_SDP_SEMANTICS } = require('../../../lib/util/constants');
const sdpFormat = require('@twilio/webrtc/lib/util/sdp').getSdpFormat(DEFAULT_CHROME_SDP_SEMANTICS);

const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../es5');

const LocalTrackPublication = require('../../../lib/media/track/localtrackpublication');
const RemoteAudioTrack = require('../../../lib/media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('../../../lib/media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('../../../lib/media/track/remotedatatrack');
const RemoteDataTrackPublication = require('../../../lib/media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('../../../lib/media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('../../../lib/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../lib/util');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const { getMediaSections } = require('../../../lib/util/sdp');
const { TrackNameIsDuplicatedError, TrackNameTooLongError } = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  capitalize,
  combinationContext,
  isRTCRtpSenderParamsSupported,
  participantsConnected,
  randomName,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
  tracksUnpublished,
  trackStarted,
  waitFor,
  waitForNot,
  waitForSometime,
  waitForTracks
} = require('../../lib/util');

describe('LocalParticipant', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"networkQualityLevelChanged" event', () => {

    function inRange(num, low, high) {
      return typeof num === 'number' && low <= num && num <= high;
    }

    function verifyNetworkQualityStats(stats, nqLevel, configLevel) {
      switch (configLevel) {
        case 1:
          assert.equal(stats, null);
          break;
        case 2:
          if (nqLevel === 0) {
            assert.equal(stats, null);
            assert.equal(stats, null);
          } else {
            assert.notEqual(stats.audio, null);
            assert.notEqual(stats.video, null);
            assert.equal(stats.audio.sendStats, null);
            assert.equal(stats.video.sendStats, null);
            assert.equal(stats.audio.recvStats, null);
            assert.equal(stats.video.recvStats, null);
          }
          break;
        case 3:
          if (nqLevel === 0) {
            assert.equal(stats, null);
            assert.equal(stats, null);
          } else {
            assert.notEqual(stats.audio, null);
            assert.notEqual(stats.video, null);
            assert.notEqual(stats.audio.sendStats, null);
            assert.notEqual(stats.video.sendStats, null);
            assert.notEqual(stats.audio.recvStats, null);
            assert.notEqual(stats.video.recvStats, null);
          }
      }
    }

    combinationContext([
      [
        [null, 1, 2, 3],
        x => `when local verbosity is ${x || 'default'}`
      ],
      [
        [null, 0, 1, 2, 3],
        x => `when remote verbosity is ${x || 'default'}`
      ]
    ], ([local, remote]) => {
      const options = Object.assign({ name: randomName() }, defaults);
      let thisRoom;
      let thatRoom;
      let localNqLevel;
      let localNqStats;
      let remoteNqLevel;
      let remoteNqStats;

      const nqConfig = (local || remote) ? { local, remote } : true;

      async function setup() {
        const thisTracks = await createLocalTracks({ audio: true, fake: true });
        thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
        const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
          assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
          assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
          resolve([level, stats]);
        }));
        const remoteNqLevelPromise = inRange(nqConfig.remote, 1, 3)
          ? new Promise(resolve => thisRoom.on('participantConnected',
            participant => participant.once('networkQualityLevelChanged', (level, stats) => {
              assert.equal(level, participant.networkQualityLevel);
              assert.deepStrictEqual(stats, participant.networkQualityStats);
              resolve([level, stats]);
            }))) : Promise.resolve([]);
        const thatTracks = await createLocalTracks({ audio: true, fake: true });
        thatRoom = await connect(getToken(randomName()), Object.assign({ tracks: thatTracks }, options));
        [localNqLevel, localNqStats] = await localNqLevelPromise;
        [remoteNqLevel, remoteNqStats] = await remoteNqLevelPromise;
      }

      before(async () => {
        await setup();
      });

      it('is raised whenever network quality level for the LocalParticipant changes', () => {
        assert.notEqual(localNqLevel, 0);
        verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);
      });

      if (inRange(nqConfig.remote, 1, 3)) {
        it('is raised whenever network quality level for the RemoteParticipant changes', () => {
          verifyNetworkQualityStats(remoteNqStats, remoteNqLevel, nqConfig.remote);
        });
      }

      after(() => {
        if (thisRoom) {
          thisRoom.disconnect();
        }
        if (thatRoom) {
          thatRoom.disconnect();
        }
      });
    });

    describe('setNetworkQualityConfiguration', () => {
      let thisRoom;
      let thatRoom;

      beforeEach(() => {
        thisRoom = null;
        thatRoom = null;
      });

      afterEach(() => {
        [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      });

      it('when networkConfiguration is false does not fire networkQualityLevelChanged', async () => {
        const nqConfig = false;
        const options = Object.assign({ name: randomName() }, defaults);
        const thisTracks = await createLocalTracks({ audio: true, fake: true });
        thisRoom = await connect(getToken('Alice_Old'), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
        const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
          assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
          assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
          resolve([level, stats]);
        }));

        const thatTracks = await createLocalTracks({ audio: true, fake: true });
        thatRoom = await connect(getToken('Bob_Old'), Object.assign({ tracks: thatTracks }, options));
        await waitForNot(localNqLevelPromise, 'networkQualityLevelChanged was not expected');
      });

      [
        {
          name: 'case 1',
          initialConfig: { local: 1, remote: 0 },
          updatedConfig: { local: 3, remote: 3 }
        },
        {
          name: 'case 2',
          initialConfig: { local: 3, remote: 3 },
          updatedConfig: { local: 1, remote: 0 }
        }
      ].forEach(testCase => {
        // eslint-disable-next-line no-warning-comments
        // TODO(mmalavalli): Re-enable once JSDK-2827 is implemented.
        it.skip('setNetworkQualityConfiguration can update the configuration after connect: (@unstable: JSDK-2827)' + testCase.name, async () => {
          let nqConfig = testCase.initialConfig;
          const options = Object.assign({ name: randomName() }, defaults);
          const thisTracks = await createLocalTracks({ audio: true, fake: true });
          thisRoom = await connect(getToken('Alice'), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));

          const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
            assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
            assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
            resolve([level, stats]);
          }));

          const thatTracks = await createLocalTracks({ audio: true, fake: true });
          thatRoom = await connect(getToken('Bob'), Object.assign({ tracks: thatTracks }, options));

          let [localNqLevel, localNqStats] = await waitFor(localNqLevelPromise, 'networkQualityLevelChanged is now expected');
          verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);

          nqConfig = testCase.updatedConfig;
          thisRoom.localParticipant.setNetworkQualityConfiguration(nqConfig);

          const updatedNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
            assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
            assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
            resolve([level, stats]);
          }));

          // we expect that when next networkQualityLevelChanged fires, it will have new stats.
          // but the problem is we get networkQualityLevelChanged only if networkLevel change. And we have no way
          // to force networkQualityLevelChanged. (JSDK-2827)
          [localNqLevel, localNqStats] = await waitFor(updatedNqLevelPromise, 'updated networkQualityLevelChanged is now expected');
          verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);
        });
      });
    });
  });

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
          // Therefore we wait for 2 seconds.
          await waitForSometime(2000);
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
          // Therefore we wait for 2 seconds.
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

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/72
  //
  describe('#unpublishTrack and #publishTrack called with two different LocalVideoTracks in quick succession', () => {
    let sid;
    let thisRoom;
    let thisParticipant;
    let thisLocalTrackPublication1;
    let thisLocalTrackPublication2;
    let thisTrack1;
    let thisTrack2;
    let thatRoom;
    let thatParticipant;
    let thatTrackUnpublished;
    let thatTrackUnsubscribed;
    let thatTrackSubscribed;
    let thatTrackPublished;
    let thatTracksPublished;
    let thatTracksUnpublished;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const constraints = { video: smallVideoConstraints, fake: true };

      // Answerer
      const thoseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
      thatRoom = await connect(getToken(randomName()), thoseOptions);

      [thisTrack1] = await createLocalTracks(constraints);

      // Offerer
      const theseOptions = Object.assign({ name: sid, tracks: [thisTrack1] }, defaults);
      thisRoom = await connect(getToken(randomName()), theseOptions);
      thisParticipant = thisRoom.localParticipant;

      await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
      thatParticipant = thatRoom.participants.get(thisParticipant.sid);
      assert(thatParticipant);

      await tracksSubscribed(thatParticipant, thisParticipant._tracks.size);

      // NOTE(mroberts): Wait 5 seconds.
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));

      const trackUnpublishedPromise = new Promise(resolve => thatParticipant.once('trackUnpublished', resolve));
      const trackUnsubscribedPromise = new Promise(resolve => thatParticipant.once('trackUnsubscribed', resolve));
      const trackPublishedPromise = new Promise(resolve => thatParticipant.once('trackPublished', resolve));
      const trackSubscribedPromise = new Promise(resolve => thatParticipant.once('trackSubscribed', resolve));

      thisLocalTrackPublication1 = thisParticipant.unpublishTrack(thisTrack1);
      [thisTrack2] = await createLocalTracks(constraints);

      [thatTrackUnpublished, thatTrackUnsubscribed, thatTrackPublished, thatTrackSubscribed, thisLocalTrackPublication2] = await Promise.all([
        trackUnpublishedPromise,
        trackUnsubscribedPromise,
        trackPublishedPromise,
        trackSubscribedPromise,
        thisParticipant.publishTrack(thisTrack2)
      ]);

      thatTracksPublished = {
        trackPublished: thatTrackPublished,
        trackSubscribed: thatTrackSubscribed
      };

      thatTracksUnpublished = {
        trackUnpublished: thatTrackUnpublished,
        trackUnsubscribed: thatTrackUnsubscribed
      };
    });

    after(() => {
      thisTrack1.stop();
      thisTrack2.stop();
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      return completeRoom(sid);
    });

    it('should eventually raise a "trackUnpublished" event for the unpublished LocalVideoTrack', () => {
      const thatTrackPublication = thatTracksUnpublished.trackUnpublished;
      assert(thatTrackPublication instanceof RemoteVideoTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatTrackPublication[prop], thisLocalTrackPublication1[prop]);
      });
    });

    it('should eventually raise a "trackPublished" event for the published LocalVideoTrack', () => {
      const thatTrackPublication = thatTracksPublished.trackPublished;
      assert(thatTrackPublication instanceof RemoteVideoTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatTrackPublication[prop], thisLocalTrackPublication2[prop]);
      });
    });

    it('should eventually raise a "trackUnsubscribed" event for the unpublished LocalVideoTrack', () => {
      const thatTrack = thatTracksUnpublished.trackUnsubscribed;
      assert.equal(thatTrack.sid, thisLocalTrackPublication1.trackSid);
      assert.equal(thatTrack.kind, thisLocalTrackPublication1.kind);
      assert.equal(thatTrack.enabled, thisLocalTrackPublication1.enabled);
      if (isChrome && sdpFormat === 'planb') {
        assert.equal(thatTrack.mediaStreamTrack.readyState, 'ended');
      }
    });

    it('should eventually raise a "trackSubscribed" event for the published LocalVideoTrack', () => {
      const thatTrack = thatTracksPublished.trackSubscribed;
      assert.equal(thatTrack.sid, thisLocalTrackPublication2.trackSid);
      assert.equal(thatTrack.kind, thisLocalTrackPublication2.kind);
      assert.equal(thatTrack.enabled, thisLocalTrackPublication2.enabled);
      assert.equal(thatTrack.mediaStreamTrack.readyState, thisTrack2.mediaStreamTrack.readyState);
    });

    it('should eventually raise a "trackStarted" event for the published LocalVideoTrack', async () => {
      if (isFirefox /* && isGroupRoom */) {
        return;
      }
      await trackStarted(thatTrackSubscribed);
    });
  });

  describe('#publishTrack called twice in quick succession', () => {
    function kindCombination(contextPrefix) {
      return [
        [
          {
            createLocalTrack: () => createLocalAudioTrack({ fake: true }),
            kind: 'audio',
            RemoteTrackPublication: RemoteAudioTrackPublication
          },
          {
            createLocalTrack: () => new LocalDataTrack(),
            kind: 'data',
            RemoteTrackPublication: RemoteDataTrackPublication
          },
          {
            createLocalTrack: () => createLocalVideoTrack(smallVideoConstraints),
            kind: 'video',
            RemoteTrackPublication: RemoteVideoTrackPublication
          }
        ],
        ({ kind }) => `${contextPrefix} a Local${capitalize(kind)}Track`
      ];
    }

    combinationContext(['with', 'and'].map(kindCombination), ([kindCombination1, kindCombination2]) => {
      const createLocalTrack1 = kindCombination1.createLocalTrack;
      const createLocalTrack2 = kindCombination2.createLocalTrack;
      const kind1 = kindCombination1.kind;
      const kind2 = kindCombination2.kind;
      const RemoteTrackPublication1 = kindCombination1.RemoteTrackPublication;
      const RemoteTrackPublication2 = kindCombination2.RemoteTrackPublication;

      let sid;
      let thisRoom;
      let thisParticipant;
      let thisLocalTrack1;
      let thisLocalTrack2;
      let thisLocalTrackPublication1;
      let thisLocalTrackPublication2;
      let thatRoom;
      let thatParticipant;
      let thoseTracks1;
      let thoseTracks2;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);

        // Answerer
        const thoseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
        thatRoom = await connect(getToken(randomName()), thoseOptions);

        [thisLocalTrack1, thisLocalTrack2] = [
          await createLocalTrack1(),
          await createLocalTrack2()
        ];

        // Offerer
        const theseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
        thisRoom = await connect(getToken(randomName()), theseOptions);
        thisParticipant = thisRoom.localParticipant;

        await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
        thatParticipant = thatRoom.participants.get(thisParticipant.sid);
        assert(thatParticipant);

        // NOTE(mroberts): Wait 5 seconds.
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));

        let thoseTracksPublished;
        let thoseTracksSubscribed;
        [thisLocalTrackPublication1, thisLocalTrackPublication2, thoseTracksPublished, thoseTracksSubscribed] =  await Promise.all([
          thisParticipant.publishTrack(thisLocalTrack1),
          thisParticipant.publishTrack(thisLocalTrack2),
          waitForTracks('trackPublished', thatParticipant, 2),
          waitForTracks('trackSubscribed', thatParticipant, 2)
        ]);

        function findTrackOrPublication(tracksOrPublications, trackSid1) {
          return tracksOrPublications.find(({ sid, trackSid }) => sid === trackSid1 || trackSid === trackSid1);
        }

        thoseTracks1 = {
          trackPublished: findTrackOrPublication(thoseTracksPublished, thisLocalTrackPublication1.trackSid),
          trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, thisLocalTrackPublication1.trackSid)
        };

        thoseTracks2 = {
          trackPublished: findTrackOrPublication(thoseTracksPublished, thisLocalTrackPublication2.trackSid),
          trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, thisLocalTrackPublication2.trackSid)
        };
      });

      after(() => {
        [thisLocalTrack1, thisLocalTrack2].forEach(track => track.stop && track.stop());
        [thisRoom, thatRoom].forEach(room => room && room.disconnect());
        return completeRoom(sid);
      });

      it(`should eventually raise "trackPublished" event for the published Local${capitalize(kind1)}Track and Local${capitalize(kind2)}Track`, () => {
        [
          [thisLocalTrackPublication1, thoseTracks1, RemoteTrackPublication1],
          [thisLocalTrackPublication2, thoseTracks2, RemoteTrackPublication2]
        ].forEach(([thisLocalTrackPublication, thoseTracks, RemoteTrackPublication]) => {
          const thatTrackPublication = thoseTracks.trackPublished;
          assert(thatTrackPublication instanceof RemoteTrackPublication);
          ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
            assert.equal(thatTrackPublication[prop], thisLocalTrackPublication[prop]);
          });
        });
      });

      it(`should eventually raise a "trackSubscribed" event for the published Local${capitalize(kind1)}Track and Local${capitalize(kind2)}Track`, () => {
        [
          [kind1, thisLocalTrack1, thisLocalTrackPublication1, thoseTracks1],
          [kind2, thisLocalTrack2, thisLocalTrackPublication2, thoseTracks2]
        ].forEach(([kind, thisLocalTrack, thisLocalTrackPublication, thoseTracks]) => {
          const thatTrack = thoseTracks.trackSubscribed;
          assert.equal(thatTrack.sid, thisLocalTrackPublication.trackSid);
          assert.equal(thatTrack.kind, thisLocalTrackPublication.kind);
          assert.equal(thatTrack.enabled, thisLocalTrackPublication.enabled);
          if (kind !== 'data') {
            assert.equal(thatTrack.mediaStreamTrack.readyState, thisLocalTrack.mediaStreamTrack.readyState);
          }
        });
      });

      const nonDataKinds = [kind1, kind2].filter(kind => kind !== 'data');
      if (nonDataKinds.length > 0) {
        it(`eventually raise a "trackStarted" event for the published ${nonDataKinds.map(kind => `Local${capitalize(kind)}Track`).join(' and ')}`, async () => {
          const thatTrack1 = thoseTracks1.trackSubscribed;
          const thatTrack2 = thoseTracks2.trackSubscribed;
          await Promise.all([thatTrack1, thatTrack2].filter(({ kind }) => kind !== 'data').map(trackStarted));
        });
      }
    });
  });

  describe('#setParameters', () => {
    const initialEncodingParameters = {
      maxAudioBitrate: 20000,
      maxVideoBitrate: 40000
    };

    combinationContext([
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 25000, 0],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 45000, 0],
        x => `when .maxVideoBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ]
    ], ([maxAudioBitrate, maxVideoBitrate]) => {
      const encodingParameters = [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].reduce((params, [prop, value]) => {
        if (typeof value !== 'undefined') {
          params[prop] = value;
        }
        return params;
      }, {});

      const maxBitrates = {
        audio: encodingParameters.maxAudioBitrate,
        video: encodingParameters.maxVideoBitrate
      };

      let peerConnections;
      let remoteDescriptions;
      let sid;
      let senders;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);
        const options = Object.assign({
          audio: true,
          name: sid,
          video: smallVideoConstraints
        }, initialEncodingParameters, defaults);
        const token = getToken(randomName());
        thisRoom = await connect(token, options);

        const thoseOptions = Object.assign({ name: options.name, tracks: [] }, defaults);
        const thoseTokens = [randomName(), randomName()].map(getToken);
        thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

        await participantsConnected(thisRoom, thoseRooms.length);
        // NOTE(mroberts): We're waiting on these events because they should
        // indicate that one or more RTCPeerConnections is established.
        await Promise.all(thoseRooms.map(thatRoom => {
          const thisParticipant = thatRoom.participants.get(thisRoom.localParticipant.sid);
          return tracksSubscribed(thisParticipant, thisRoom.localParticipant.tracks.size);
        }));
        peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
        thisRoom.localParticipant.setParameters(encodingParameters);

        if (isRTCRtpSenderParamsSupported) {
          // NOTE(mmalavalli): If applying bandwidth constraints using RTCRtpSender.setParameters(),
          // which is an asynchronous operation, wait for a little while until the changes are applied.
          await new Promise(resolve => setTimeout(resolve, 5000));
          senders = flatMap(peerConnections, pc => pc.getSenders().filter(sender => sender.track));
          return;
        }

        function getRemoteDescription(pc) {
          return Object.keys(encodingParameters).length > 0
            ? new Promise(resolve => {
              const pcSetRemoteDescription = pc.setRemoteDescription;
              pc.setRemoteDescription = function setRemoteDescription(description) {
                resolve(description);
                pc.setRemoteDescription = pcSetRemoteDescription;
                return pcSetRemoteDescription.call(this, description);
              };
            })
            : Promise.resolve(pc.remoteDescription);
        }

        remoteDescriptions = await Promise.all(peerConnections.map(getRemoteDescription));
      });

      ['audio', 'video'].forEach(kind => {
        const action = typeof maxBitrates[kind] === 'undefined'
          ? 'preserve'
          : maxBitrates[kind]
            ? 'set'
            : 'remove';
        const newOrExisting = maxBitrates[kind]
          ? 'new'
          : 'existing';

        it(`should ${action} the ${newOrExisting} .max${capitalize(kind)}Bitrate`, () => {
          if (isRTCRtpSenderParamsSupported) {
            senders.filter(({ track }) => track.kind === kind).forEach(sender => {
              const { encodings } = sender.getParameters();
              if (action === 'preserve') {
                encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, initialEncodingParameters[`max${capitalize(kind)}Bitrate`]));
              } else if (action === 'set') {
                encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, maxBitrates[kind]));
              } else {
                encodings.forEach(encoding => assert.equal('maxBitrate' in encoding, false));
              }
            });
            return;
          }

          flatMap(remoteDescriptions, description => {
            return getMediaSections(description.sdp, kind, '(recvonly|sendrecv)');
          }).forEach(section => {
            const modifier = isFirefox
              ? 'TIAS'
              : 'AS';

            let maxBitrate = action === 'preserve'
              ? initialEncodingParameters[`max${capitalize(kind)}Bitrate`]
              : maxBitrates[kind];

            maxBitrate = maxBitrate
              ? isFirefox
                ? maxBitrate
                : Math.round((maxBitrate + 16000) / 950)
              : null;

            const bLinePattern = maxBitrate
              ? new RegExp(`\r\nb=${modifier}:${maxBitrate}`)
              : /\r\nb=(AS|TIAS)/;

            assert(maxBitrate ? bLinePattern.test(section) : !bLinePattern.test(section));
          });
        });
      });

      after(() => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        return completeRoom(sid);
      });
    });
  });

  // NOTE (mmalavalli): This test ensures that the behavior described in
  // https://issues.corp.twilio.com/browse/JSDK-2212 is not observed.
  describe('JSDK-2212', () => {
    [
      ['disabled', 'disable'],
      ['enabled', 'enable'],
      ['stopped', 'stop']
    ].forEach(([event, action]) => {
      context(`when a LocalTrack is unpublished in a "${event}" event listener`, () => {
        context('when the listener is added to the LocalTrack before publishing it to the Room', () => {
          it('should not throw', async () => {
            let room;
            const track = await createLocalAudioTrack();
            if (event === 'enabled') {
              track.disable();
            }
            track.once(event, () => {
              room.localParticipant.unpublishTrack(track);
            });
            room = await connect(getToken('foo'), Object.assign({
              name: randomName(),
              tracks: [track]
            }, defaults));
            assert.doesNotThrow(() => track[action]());
          });
        });
      });
    });
  });

  (defaults.topology === 'peer-to-peer' ? describe.skip : describe)('JSDK-2534', () => {
    let localVideoTrackPublications;
    let localVideoTracks;
    let room;
    let sid;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      localVideoTracks = await Promise.all([
        createLocalVideoTrack(smallVideoConstraints),
        createLocalVideoTrack(smallVideoConstraints)
      ]);

      // Step 1: Connect to a Room with a LocalAudioTrack.
      const options = Object.assign({ audio: true, fake: true, name: sid }, defaults);
      const token = getToken(randomName());
      room = await connect(token, options);

      // Step 2: Try to publish two LocalVideoTracks.
      // The bug is reproducible if this promise never resolves.
      localVideoTrackPublications = await Promise.all(localVideoTracks.map(track => room.localParticipant.publishTrack(track)));
    });

    it('should be fixed', () => {
      assert.equal(localVideoTrackPublications.length, localVideoTracks.length);
    });

    after(() => {
      if (Array.isArray(localVideoTracks)) {
        localVideoTracks.forEach(track => track.stop());
      }
      if (room) {
        room.disconnect();
      }
      return completeRoom(sid);
    });
  });

  describe('JSDK-2769 - #publishTrack and #unpublishTrack, when called in rapid succession', () => {
    let error;
    let publication;

    before(async () => {
      const audioTrack = await createLocalAudioTrack();
      const name = randomName();
      const tracks = [audioTrack, await createLocalVideoTrack()];
      let videoTrack;

      const rooms = await Promise.all([randomName(), randomName()].map(getToken).map((token, i) => connect(token, Object.assign({
        name,
        tracks: i === 0 ? [audioTrack] : tracks
      }, defaults))));

      await Promise.all(rooms.map(room => participantsConnected(room, 1)));

      try {
        for (let i = 0; i < 10; i++) {
          // eslint-disable-next-line no-await-in-loop
          videoTrack = await createLocalVideoTrack();
          // eslint-disable-next-line no-await-in-loop
          publication = await rooms[0].localParticipant.publishTrack(videoTrack);
          videoTrack.stop();
          rooms[0].localParticipant.unpublishTrack(videoTrack);
        }
      } catch (e) {
        error = e;
      }
    });

    it('should complete without any error', () => {
      assert(publication);
      assert(!error);
    });
  });

  describe('JSDK-2985 - Clean up LocalTrack event listeners added by the LocalTrackPublication after leaving room', () => {
    let room;
    let error;
    let listenerCount = 0;
    let localAudioTrack;
    const events = ['enabled', 'disabled', 'started', 'stopped', 'message'];
    async function setupRoom(token, options) {
      let room = await connect(token, options);
      return room;
    }

    before(async () => {
      try {
        localAudioTrack = await createLocalAudioTrack({ fake: true });
        const token = getToken(randomName());
        const options = Object.assign({ tracks: [localAudioTrack] }, defaults);
        // eslint-disable-next-line no-await-in-loop
        room = await setupRoom(token, options);
        if (room) {
          room.disconnect();
        }
        events.forEach(event => {
          listenerCount += localAudioTrack.listenerCount(event);
        });
      } catch (e) {
        error = e;
      }
    });

    it('should have 0 event listeners after disconnecting from multiple rooms', () => {
      assert.strictEqual(listenerCount, 0);
    });

    it('should not throw any errors', () => {
      assert(!error);
    });

    after(() => {
      if (room) {
        room.disconnect();
      }
    });
  });
});
