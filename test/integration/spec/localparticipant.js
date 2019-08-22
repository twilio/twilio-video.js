'use strict';

const assert = require('assert');
const { DEFAULT_CHROME_SDP_SEMANTICS } = require('../../../lib/util/constants');
const sdpFormat = require('@twilio/webrtc/lib/util/sdp').getSdpFormat(DEFAULT_CHROME_SDP_SEMANTICS);

const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('../../../lib');

const LocalTrackPublication = require('../../../lib/media/track/localtrackpublication');
const RemoteAudioTrack = require('../../../lib/media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('../../../lib/media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('../../../lib/media/track/remotedatatrack');
const RemoteDataTrackPublication = require('../../../lib/media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('../../../lib/media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('../../../lib/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../lib/util');
const { getMediaSections } = require('../../../lib/util/sdp');
const { TrackNameIsDuplicatedError, TrackNameTooLongError } = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { isRTCRtpSenderParamsSupported, smallVideoConstraints } = require('../../lib/util');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  randomName,
  tracksSubscribed,
  tracksPublished,
  tracksUnpublished,
  trackStarted,
  waitForTracks
} = require('../../lib/util');

describe('LocalParticipant', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"networkQualityLevelChanged" event', () => {
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

      function inRange(num, low, high) {
        return typeof num === 'number' && low <= num && num <= high;
      }

      async function setup() {
        const thisTracks = await createLocalTracks({ audio: true, fake: true });
        thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
        const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged',
          (level, stats) => resolve([level, stats])));
        const remoteNqLevelPromise = inRange(nqConfig.remote, 1, 3)
          ? new Promise(resolve => thisRoom.on('participantConnected',
            participant => participant.once('networkQualityLevelChanged', (level, stats) => resolve([level, stats]))))
          : Promise.resolve([]);
        const thatTracks = await createLocalTracks({ audio: true, fake: true });
        thatRoom = await connect(getToken(randomName()), Object.assign({ tracks: thatTracks }, options));
        [localNqLevel, localNqStats] = await localNqLevelPromise;
        [remoteNqLevel, remoteNqStats] = await remoteNqLevelPromise;
      }

      before(async () => {
        await setup();
      });

      it('is raised whenever network quality level for the LocalParticipant changes', () => {
        assert.equal(localNqLevel, thisRoom.localParticipant.networkQualityLevel);
        switch (nqConfig.local) {
          case 1:
            assert.equal(localNqStats, null);
            break;
          case 2:
            assert.notEqual(localNqStats.audio, null);
            assert.notEqual(localNqStats.video, null);
            assert.equal(localNqStats.audio.sendStats, null);
            assert.equal(localNqStats.video.sendStats, null);
            assert.equal(localNqStats.audio.recvStats, null);
            assert.equal(localNqStats.video.recvStats, null);
            break;
          case 3:
            assert.notEqual(localNqStats.audio, null);
            assert.notEqual(localNqStats.video, null);
            assert.notEqual(localNqStats.audio.sendStats, null);
            assert.notEqual(localNqStats.video.sendStats, null);
            assert.notEqual(localNqStats.audio.recvStats, null);
            assert.notEqual(localNqStats.video.recvStats, null);
        }
        assert.deepStrictEqual(localNqStats, thisRoom.localParticipant.networkQualityStats);
      });

      if (inRange(nqConfig.remote, 1, 3)) {
        it('is raised whenever network quality level for the RemoteParticipant changes', () => {
          assert.equal(remoteNqLevel, Array.from(thisRoom.participants.values())[0].networkQualityLevel);
          switch (nqConfig.remote) {
            case 1:
              assert.equal(remoteNqStats, null);
              break;
            case 2:
              assert.notEqual(remoteNqStats.audio, null);
              assert.notEqual(remoteNqStats.video, null);
              assert.equal(remoteNqStats.audio.sendStats, null);
              assert.equal(remoteNqStats.video.sendStats, null);
              assert.equal(remoteNqStats.audio.recvStats, null);
              assert.equal(remoteNqStats.video.recvStats, null);
              break;
            case 3:
              assert.notEqual(remoteNqStats.audio, null);
              assert.notEqual(remoteNqStats.video, null);
              assert.notEqual(remoteNqStats.audio.sendStats, null);
              assert.notEqual(remoteNqStats.video.sendStats, null);
              assert.notEqual(remoteNqStats.audio.recvStats, null);
              assert.notEqual(remoteNqStats.video.recvStats, null);
          }
          assert.deepStrictEqual(remoteNqStats, Array.from(thisRoom.participants.values())[0].networkQualityStats);
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
  });

  describe('#publishTrack', () => {
    let room;
    let sid;
    let trackPublications = [];
    let tracks;

    async function setup() {
      sid = await createRoom(name, defaults.topology);
      const options = Object.assign({ name: sid, tracks: [] }, defaults);
      const token = getToken(randomName());
      [room, tracks] = await Promise.all([
        connect(token, options),
        createLocalTracks({ audio: true, video: smallVideoConstraints })
      ]);
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
          trackPublications = await Promise.all(tracks.map(track => {
            return room.localParticipant.publishTrack(track);
          }));
        }
      ]
    ].forEach(([ctx, publish]) => {
      context(ctx, () => {
        before(async () => {
          await setup();
          await publish();
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

    context('when a LocalTrack is published to two Rooms', () => {
      let anotherRoom;
      let anotherSid;

      before(async () => {
        anotherSid =  await createRoom(randomName(), defaults.topology);
        const options = Object.assign({ name: anotherSid, tracks: [] }, defaults);
        const token = getToken(randomName());
        [anotherRoom] = await Promise.all([
          connect(token, options),
          setup()
        ]);

        trackPublications = await Promise.all([
          room.localParticipant.publishTrack(tracks[0]),
          anotherRoom.localParticipant.publishTrack(tracks[0])
        ]);
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
        ['never', 'previously'],
        x => `that has ${x} been published`
      ]
    ], ([isEnabled, kind, withName, when]) => {
      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Enable this scenario for Firefox when the following
      // bug is fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=1526253
      if (isFirefox && kind === 'data' && when === 'previously') {
        return;
      }

      let thisRoom;
      let thisParticipant;
      let thisLocalTrackPublication;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
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
        const identities = [randomName(), randomName(), randomName()];
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
        await tracksPublished(thisParticipant, thisParticipant._tracks.size);

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);
        thoseRooms = await Promise.all(thoseTokens.map(thatToken => connect(thatToken, thoseOptions)));

        await Promise.all([thisRoom].concat(thoseRooms).map(room => {
          return participantsConnected(room, identities.length - 1);
        }));

        thoseParticipants = thoseRooms.map(thatRoom => {
          return thatRoom.participants.get(thisParticipant.sid);
        });

        await Promise.all(thoseParticipants.map(thatParticipant => {
          return tracksSubscribed(thatParticipant, thisParticipant._tracks.size);
        }));

        thoseTracksBefore = flatMap(thoseParticipants, thatParticipant => {
          return [...thatParticipant._tracks.values()];
        });

        if (when === 'previously') {
          thisParticipant.unpublishTrack(thisTrack);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksUnpublished(thatParticipant, thisParticipant._tracks.size);
          }));
        }

        [thisLocalTrackPublication, thoseTracksPublished, thoseTracksSubscribed] = await Promise.all([
          thisParticipant.publishTrack(thisTrack),
          ...['trackPublished', 'trackSubscribed'].map(event => {
            return Promise.all(thoseParticipants.map(async thatParticipant => {
              const [trackOrPublication] = await waitForTracks(event, thatParticipant, 1);
              return trackOrPublication;
            }));
          })
        ]);

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

      ['isTrackEnabled', 'trackName', 'trackSid'].forEach(prop => {
        it(`should set the RemoteTrackPublication's .${prop} to the LocalTrackPublication's .${prop}`, () => {
          const thoseTrackPublications = thoseTracksMap.trackPublished;
          thoseTrackPublications.forEach(thatPublication => assert.equal(thatPublication[prop], thisLocalTrackPublication[prop]));
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
              const receivedData = await Promise.all(thoseTracksReceivedData);
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

  describe('#unpublishTrack', () => {
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
        const identities = [randomName(), randomName(), randomName()];
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
        thisParticipant = thisRoom.localParticipant;
        await tracksPublished(thisParticipant, thisParticipant._tracks.size);

        const thoseIdentities = identities.slice(1);
        const thoseTokens = thoseIdentities.map(getToken);
        const thoseOptions = Object.assign({ tracks: [] }, options);
        thoseRooms = await Promise.all(thoseTokens.map(thatToken => connect(thatToken, thoseOptions)));

        await Promise.all([thisRoom].concat(thoseRooms).map(room => {
          return participantsConnected(room, identities.length - 1);
        }));

        thoseParticipants = thoseRooms.map(thatRoom => {
          return thatRoom.participants.get(thisParticipant.sid);
        });

        await Promise.all(thoseParticipants.map(thatParticipant => {
          return tracksSubscribed(thatParticipant, thisParticipant._tracks.size);
        }));

        if (when !== 'published') {
          thisParticipant.unpublishTrack(thisTrack);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksUnpublished(thatParticipant, thisParticipant._tracks.size);
          }));

          await Promise.all([
            thisParticipant.publishTrack(thisTrack),
            ...thoseParticipants.map(thatParticipant => tracksSubscribed(thatParticipant, thisParticipant._tracks.size))
          ]);
        }

        thisLocalTrackPublication = thisParticipant.unpublishTrack(thisTrack);

        thosePublicationsUnsubscribed = flatMap(thoseParticipants, participant => [...participant.tracks.values()]).map(publication => {
          return new Promise(resolve => publication.once('unsubscribed', resolve));
        });

        [thoseTracksUnsubscribed, thoseTracksUnpublished] = await Promise.all([
          'trackUnsubscribed',
          'trackUnpublished'
        ].map(event => {
          return Promise.all(thoseParticipants.map(async thatParticipant => {
            const [trackOrPublication] = await waitForTracks(event, thatParticipant, 1);
            return trackOrPublication;
          }));
        }));

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
        const thoseTracks = await Promise.all(thosePublicationsUnsubscribed);
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

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/81
  //
  describe('#publishTrack called twice with two different LocalTracks in quick succession', () => {
    let sid;
    let thisRoom;
    let thisParticipant;
    let thisAudioTrack;
    let thisLocalAudioTrackPublication;
    let thisLocalVideoTrackPublication;
    let thisVideoTrack;
    let thatRoom;
    let thatParticipant;
    let thoseAudioTracks;
    let thoseVideoTracks;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const constraints = { audio: true, video: smallVideoConstraints, fake: true };

      // Answerer
      const thoseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
      thatRoom = await connect(getToken(randomName()), thoseOptions);

      [thisAudioTrack, thisVideoTrack] = await createLocalTracks(constraints);

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
      [thisLocalAudioTrackPublication, thisLocalVideoTrackPublication, thoseTracksPublished, thoseTracksSubscribed] =  await Promise.all([
        thisParticipant.publishTrack(thisAudioTrack),
        thisParticipant.publishTrack(thisVideoTrack),
        waitForTracks('trackPublished', thatParticipant, 2),
        waitForTracks('trackSubscribed', thatParticipant, 2)
      ]);

      function findTrackOrPublication(tracksOrPublications, kind) {
        return tracksOrPublications.find(tracksOrPublication => tracksOrPublication.kind === kind);
      }

      thoseAudioTracks = {
        trackPublished: findTrackOrPublication(thoseTracksPublished, 'audio'),
        trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, 'audio')
      };
      thoseVideoTracks = {
        trackPublished: findTrackOrPublication(thoseTracksPublished, 'video'),
        trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, 'video')
      };
    });

    after(() => {
      thisAudioTrack.stop();
      thisVideoTrack.stop();
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      return completeRoom(sid);
    });

    it('should eventually raise "trackPublished" event for each published LocalTracks', () => {
      const thatAudioTrackPublication = thoseAudioTracks.trackPublished;
      assert(thatAudioTrackPublication instanceof RemoteAudioTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatAudioTrackPublication[prop], thisLocalAudioTrackPublication[prop]);
      });

      const thatVideoTrackPublication = thoseVideoTracks.trackPublished;
      assert(thatVideoTrackPublication instanceof RemoteVideoTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatVideoTrackPublication[prop], thisLocalVideoTrackPublication[prop]);
      });
    });

    it('should eventually raise a "trackSubscribed" event for each published LocalTracks', () => {
      const thatAudioTrack = thoseAudioTracks.trackSubscribed;
      assert.equal(thatAudioTrack.sid, thisLocalAudioTrackPublication.trackSid);
      assert.equal(thatAudioTrack.kind, thisLocalAudioTrackPublication.kind);
      assert.equal(thatAudioTrack.enabled, thisLocalAudioTrackPublication.enabled);
      assert.equal(thatAudioTrack.mediaStreamTrack.readyState, thisAudioTrack.mediaStreamTrack.readyState);

      const thatVideoTrack = thoseVideoTracks.trackSubscribed;
      assert.equal(thatVideoTrack.sid, thisLocalVideoTrackPublication.trackSid);
      assert.equal(thatVideoTrack.kind, thisLocalVideoTrackPublication.kind);
      assert.equal(thatVideoTrack.enabled, thisLocalVideoTrackPublication.enabled);
      assert.equal(thatVideoTrack.mediaStreamTrack.readyState, thisVideoTrack.mediaStreamTrack.readyState);
    });

    it('should eventually raise a "trackStarted" event for each published LocalTrack', async () => {
      const thatAudioTrack = thoseAudioTracks.trackSubscribed;
      const thatVideoTrack = thoseVideoTracks.trackSubscribed;
      await Promise.all([thatAudioTrack, thatVideoTrack].map(trackStarted));
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
        [undefined, null, 25000],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 45000],
        x => `when .maxVideoBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
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
              encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, action === 'preserve'
                ? initialEncodingParameters[`max${capitalize(kind)}Bitrate`]
                : maxBitrates[sender.track.kind] || 0));
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

  describe('#publishTrack and #unpublishTrack, when called in rapid succession', () => {
    let error;
    let publication;

    before(async () => {
      const audioTrack = await createLocalAudioTrack();
      const name = randomName();
      let videoTrack;

      const rooms = await Promise.all([randomName(), randomName()].map(getToken).map(token => connect(token, Object.assign({
        name,
        tracks: [audioTrack]
      }, defaults))));

      await Promise.all(rooms.map(room => participantsConnected(room, 1)));

      try {
        for (let i = 0; i < 10; i++) {
          // eslint-disable-next-line no-await-in-loop
          videoTrack = videoTrack ? new LocalVideoTrack(videoTrack.mediaStreamTrack.clone()) : await createLocalVideoTrack();
          // eslint-disable-next-line no-await-in-loop
          publication = await rooms[0].localParticipant.publishTrack(videoTrack);
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
});
