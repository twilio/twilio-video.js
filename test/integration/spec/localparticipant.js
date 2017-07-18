'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const getToken = require('../../lib/token');
const env = require('../../env');
const { flatMap, guessBrowser } = require('../../../lib/util');
const { getMediaSections } = require('../../../lib/util/sdp');
const Track = require('../../../lib/media/track');
const PublishedTrack = require('../../../lib/media/track/publishedtrack');
const RemoteAudioTrack = require('../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../lib/media/track/remotevideotrack');

const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack
} = require('../../../lib');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  pairs,
  randomName,
  tracksAdded,
  tracksRemoved,
  trackStarted,
  waitForTracks
} = require('../../lib/util');

const defaultOptions = ['ecsServer', 'logLevel', 'wsServer', 'wsServerInsights'].reduce((defaultOptions, option) => {
  if (env[option] !== undefined) {
    defaultOptions[option] = env[option];
  }
  return defaultOptions;
}, {});

const guess = guessBrowser();
const isChrome = guess === 'chrome';
const isFirefox = guess === 'firefox';
const isSafari = guess === 'safari';

(navigator.userAgent === 'Node'
  ? describe.skip
  : describe
)('LocalParticipant', function() {
  this.timeout(60000);

  describe('#publishTrack', () => {
    let publishedTracks = [];
    let room;
    let tracks;

    const setup = async () => {
      const name = randomName();
      const options = Object.assign({ name, tracks: [] }, defaultOptions);
      const token = getToken(randomName());
      [ room, tracks ] = await Promise.all([
        connect(token, options),
        createLocalTracks()
      ]);
    };

    [
      [
        'when two LocalTracks (audio and video) are published sequentially',
        async () => {
          publishedTracks = [
            await room.localParticipant.publishTrack(tracks[0]),
            await room.localParticipant.publishTrack(tracks[1])
          ];
        }
      ],
      [
        'when two LocalTracks (audio and video) are published together',
        async () => {
          publishedTracks = await Promise.all(tracks.map(track => {
            return room.localParticipant.publishTrack(track);
          }));
        }
      ]
    ].forEach(([ ctx, publish ]) => {
      context(ctx, () => {
        before(async () => {
          await setup();
          await publish();
        });

        it('should return PublishedTracks for both LocalTracks', () => {
          publishedTracks.forEach((publishedTrack, i) => {
            const track = tracks[i];
            assert(publishedTrack instanceof PublishedTrack);
            assert.equal(publishedTrack.id, track.id);
            assert.equal(publishedTrack.kind, track.kind);
            assert(publishedTrack.sid.match(/^MT[a-f0-9]{32}$/));
          });
        });

        it('should add both the LocalTracks to the LocalParticipant\'s .tracks and their respective kinds\' .(audio/video)Tracks collections', () => {
          tracks.forEach(track => {
            assert.equal(room.localParticipant.tracks.get(track.id), track);
            assert.equal(room.localParticipant[`${track.kind}Tracks`].get(track.id), track);
          });
        });

        it('should add both the PublishedTracks to the LocalParticipant\'s .publishedTracks and their respective kinds\' .published(Audio/Video)Tracks collections', () => {
          publishedTracks.forEach(track => {
            assert.equal(room.localParticipant.publishedTracks.get(track.id), track);
            assert.equal(room.localParticipant[`published${capitalize(track.kind)}Tracks`].get(track.id), track);
          });
        });

        after(() => {
          publishedTracks = [];
          room.disconnect();
          tracks = [];
        });
      });
    });

    context('when a LocalTrack is published to two Rooms', () => {
      let anotherRoom;

      before(async () => {
        const name = randomName();
        const options = Object.assign({ name, tracks: [] }, defaultOptions);
        const token = getToken(randomName());

        [ anotherRoom ] = await Promise.all([
          connect(token, options),
          setup()
        ]);

        publishedTracks = await Promise.all([
          room.localParticipant.publishTrack(tracks[0]),
          anotherRoom.localParticipant.publishTrack(tracks[0])
        ]);
      });

      it('should add the LocalTrack to the LocalParticipant\'s .tracks in both Rooms', () => {
        assert.equal(room.localParticipant.tracks.get(tracks[0].id), tracks[0]);
        assert.equal(anotherRoom.localParticipant.tracks.get(tracks[0].id), tracks[0]);
      });

      it('should create two different PublishedTracks', () => {
        assert(publishedTracks[0] instanceof PublishedTrack);
        assert(publishedTracks[1] instanceof PublishedTrack);
        assert.notEqual(publishedTracks[0], publishedTracks[1]);
      });

      it('should add each PublishedTrack to its corresponding Room\'s LocalParticipant .publishedTracks', () => {
        assert.equal(room.localParticipant.publishedTracks.get(tracks[0].id), publishedTracks[0]);
        assert.equal(anotherRoom.localParticipant.publishedTracks.get(tracks[0].id), publishedTracks[1]);
      });

      it('should assign different SIDs to the two PublishedTracks', () => {
        assert.notEqual(publishedTracks[0].sid, publishedTracks[1].sid);
      });

      after(() => {
        publishedTracks = [];
        room.disconnect();
        anotherRoom.disconnect();
        tracks = [];
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
          return;
        }
        throw new Error('Unexpected resolution');
      });

      after(() => {
        publishedTracks = [];
        tracks = [];
      });
    });

    combinationContext([
      [
        [true, false],
        x => `called with ${x ? 'an enabled' : 'a disabled'}`
      ],
      [
        ['audio', 'video'],
        x => `Local${capitalize(x)}Track`
      ],
      [
        ['never', 'previously'],
        x => `that has ${x} been published`
      ]
    ], ([isEnabled, kind, when]) => {
      let thisRoom;
      let thisParticipant;
      let thisPublishedTrack;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thoseTracksBefore;
      let thoseTracksAdded;
      let thoseTracksSubscribed;
      let thoseTracksMap;

      before(async () => {
        const name = randomName();
        const identities = [randomName(), randomName(), randomName()];
        const options = Object.assign({ name }, defaultOptions);

        thisTrack = kind === 'audio'
          ? await createLocalAudioTrack()
          : await createLocalVideoTrack();
        thisTrack.enable(isEnabled);

        const tracks = when === 'previously'
          ? [thisTrack]
          : [];

        const thisIdentity = identities[0];
        const thisToken = getToken(thisIdentity);
        const theseOptions = Object.assign({ tracks }, options);
        thisRoom = await connect(thisToken, theseOptions);
        thisParticipant = thisRoom.localParticipant;

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
          return tracksAdded(thatParticipant, thisParticipant.tracks.size);
        }));

        thoseTracksBefore = flatMap(thoseParticipants, thatParticipant => {
          return [...thatParticipant.tracks.values()];
        });

        if (when === 'previously') {
          thisParticipant.unpublishTrack(thisTrack);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksRemoved(thatParticipant, thisParticipant.tracks.size);
          }));
        }

        [thisPublishedTrack, thoseTracksAdded, thoseTracksSubscribed] = await Promise.all([
          thisParticipant.publishTrack(thisTrack),
          ...[ 'trackAdded', 'trackSubscribed' ].map(event => {
            return Promise.all(thoseParticipants.map(thatParticipant => {
              return waitForTracks(event, thatParticipant, 1).then(tracks => tracks[0]);
            }));
          })
        ]);

        thoseTracksMap = {
          trackAdded: thoseTracksAdded,
          trackSubscribed: thoseTracksSubscribed
        };
      });

      after(() => {
        thisTrack.stop();
        [thisRoom].concat(thoseRooms).forEach(room => room.disconnect());
      });

      [ 'trackAdded', 'trackSubscribed' ].forEach(event => {
        it(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack`, () => {
          const thoseTracks = thoseTracksMap[event];
          thoseTracks.forEach(thatTrack => assert(thatTrack instanceof (thatTrack.kind === 'audio' ? RemoteAudioTrack : RemoteVideoTrack)));
        });

        describe(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack and`, () => {
          it('should set the RemoteTrack\'s .sid to the PublishedTrack\'s .sid', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.sid, thisPublishedTrack.sid));
          });

          it('should set each RemoteTrack\'s .id to the PublishedTrack\'s .id', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.id, thisPublishedTrack.id));
          });

          it(`should set each RemoteTrack's .kind to "${kind}"`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
          });

          it(`should set each RemoteTrack's .isEnabled state to ${isEnabled}`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
          });

          if (when === 'previously') {
            it('the RemoteTrack should be a new RemoteTrack instance, despite sharing the same .id as the previously-added RemoteTrack', () => {
              const thoseTracks = thoseTracksMap[event];
              assert.equal(thoseTracksBefore.length, thoseTracks.length);
              thoseTracksBefore.forEach((thatTrackBefore, i) => {
                const thatTrackAfter = thoseTracks[i];
                assert.equal(thatTrackAfter.id, thatTrackBefore.id);
                assert.equal(thatTrackAfter.kind, thatTrackBefore.kind);
                assert.equal(thatTrackAfter.enabled, thatTrackBefore.enabled);
                assert.notEqual(thatTrackAfter.sid, thatTrackBefore.sid);
                assert.notEqual(thatTrackAfter, thatTrackBefore);
              });
            });
          }
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
        ['audio', 'video'],
        x => `Local${capitalize(x)}Track`
      ],
      [
        ['published', 'published, unpublished, and then published again'],
        x => 'that was ' + x
      ]
    ], ([isEnabled, kind, when]) => {
      let thisRoom;
      let thisParticipant;
      let thisPublishedTrack;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thoseTracksRemoved;
      let thoseTracksUnsubscribed;
      let thoseTracksMap;
      let thoseUnsubscribed;

      before(async () => {
        const name = randomName();
        const identities = [randomName(), randomName(), randomName()];
        const options = Object.assign({ name }, defaultOptions);

        thisTrack = kind === 'audio'
          ? await createLocalAudioTrack()
          : await createLocalVideoTrack();
        thisTrack.enable(isEnabled);

        const tracks = [thisTrack];

        const thisIdentity = identities[0];
        const thisToken = getToken(thisIdentity);
        const theseOptions = Object.assign({ tracks }, options);
        thisRoom = await connect(thisToken, theseOptions);
        thisParticipant = thisRoom.localParticipant;

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
          return tracksAdded(thatParticipant, thisParticipant.tracks.size);
        }));

        if (when !== 'published') {
          thisParticipant.unpublishTrack(thisTrack);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksRemoved(thatParticipant, thisParticipant.tracks.size);
          }));

          await Promise.all([
            thisParticipant.publishTrack(thisTrack),
            ...thoseParticipants.map(thatParticipant => tracksAdded(thatParticipant, thisParticipant.tracks.size))
          ]);
        }

        thisPublishedTrack = thisParticipant.unpublishTrack(thisTrack);

        thoseUnsubscribed = flatMap(thoseParticipants, participant => [...participant.tracks.values()]).map(track => {
          return new Promise(resolve => track.once('unsubscribed', resolve));
        });

        [thoseTracksRemoved, thoseTracksUnsubscribed] = await Promise.all([ 'trackRemoved', 'trackUnsubscribed' ].map(event => {
          return Promise.all(thoseParticipants.map(thatParticipant => {
            return waitForTracks(event, thatParticipant, 1).then(tracks => tracks[0]);
          }));
        }));

        thoseTracksMap = {
          trackRemoved: thoseTracksRemoved,
          trackUnsubscribed: thoseTracksUnsubscribed
        };
      });

      after(() => {
        thisTrack.stop();
        [thisRoom].concat(thoseRooms).forEach(room => room.disconnect());
      });

      it('should raise "unsubscribed" events on the corresponding RemoteParticipants\' RemoteTracks', async () => {
        await thoseUnsubscribed;
      });

      [ 'trackRemoved', 'trackUnsubscribed' ].forEach(event => {
        it(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack`, () => {
          const thoseTracks = thoseTracksMap[event];
          thoseTracks.forEach(thatTrack => assert(thatTrack instanceof (thatTrack.kind === 'audio' ? RemoteAudioTrack : RemoteVideoTrack)));
        });

        describe(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack and`, () => {
          it('should set the RemoteTrack\'s .sid to the PublishedTrack\'s .sid', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.sid, thisPublishedTrack.sid));
          });

          it('should set each RemoteTrack\'s .id to the PublishedTrack\'s .id', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.id, thisPublishedTrack.id));
          });

          it(`should set each RemoteTrack's .kind to "${kind}"`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
          });

          it(`should set each RemoteTrack's .isEnabled state to ${isEnabled}`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
          });

          it(`should set each RemoteTrack's .isSubscribed to false`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isSubscribed, false));
          });
        });
      });
    });
  });

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/72
  //
  describe('#unpublishTrack and #publishTrack called with two different LocalVideoTracks in quick succession', () => {
    let thisRoom;
    let thisParticipant;
    let thisPublishedTrack1;
    let thisPublishedTrack2;
    let thisTrack1;
    let thisTrack2;
    let thatRoom;
    let thatParticipant;
    let thatTrackRemoved;
    let thatTrackAdded;
    let thatTrackUnsubscribed;
    let thatTrackSubscribed;
    let thatTracksPublished;
    let thatTracksUnpublished;

    before(async () => {
      const name = randomName();
      const constraints = { video: true, fake: true };

      // Answerer
      const thoseOptions = Object.assign({ name, tracks: [] }, defaultOptions);
      thatRoom = await connect(getToken(randomName()), thoseOptions);

      [thisTrack1] = await createLocalTracks(constraints);

      // Offerer
      const theseOptions = Object.assign({ name, tracks: [thisTrack1] }, defaultOptions);
      thisRoom = await connect(getToken(randomName()), theseOptions);
      thisParticipant = thisRoom.localParticipant;

      await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
      thatParticipant = thatRoom.participants.get(thisParticipant.sid);
      assert(thatParticipant);

      await tracksAdded(thatParticipant, thisParticipant.tracks.size);

      // NOTE(mroberts): Wait 5 seconds.
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));

      const trackUnsubscribedPromise = new Promise(resolve => thatParticipant.once('trackUnsubscribed', resolve));
      const trackRemovedPromise = new Promise(resolve => thatParticipant.once('trackRemoved', resolve));
      const trackAddedPromise = new Promise(resolve => thatParticipant.once('trackAdded', resolve));
      const trackSubscribedPromise = new Promise(resolve => thatParticipant.once('trackSubscribed', resolve));

      thisPublishedTrack1 = thisParticipant.unpublishTrack(thisTrack1);
      [thisTrack2] = await createLocalTracks(constraints);

      [thatTrackUnsubscribed, thatTrackRemoved, thatTrackAdded, thatTrackSubscribed, thisPublishedTrack2] = await Promise.all([
        trackUnsubscribedPromise,
        trackRemovedPromise,
        trackAddedPromise,
        trackSubscribedPromise,
        thisParticipant.publishTrack(thisTrack2)
      ]);

      thatTracksPublished = {
        trackAdded: thatTrackAdded,
        trackSubscribed: thatTrackSubscribed
      };

      thatTracksUnpublished = {
        trackRemoved: thatTrackRemoved,
        trackUnsubscribed: thatTrackUnsubscribed
      };
    });

    after(() => {
      thisTrack2.stop();
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    [ 'trackUnsubscribed', 'trackRemoved' ].forEach(event => {
      it(`should eventually raise a "${event}" event with the unpublished LocalVideoTrack`, () => {
        const thatTrack = thatTracksUnpublished[event];
        assert.equal(thatTrack.sid, thisPublishedTrack1.sid)
        assert.equal(thatTrack.id, thisPublishedTrack1.id);
        assert.equal(thatTrack.kind, thisPublishedTrack1.kind);
        assert.equal(thatTrack.enabled, thisPublishedTrack1.enabled);
        if (!isFirefox && !isSafari) {
          assert.equal(thatTrack.mediaStreamTrack.readyState, 'ended');
        }
      });
    });

    [ 'trackAdded', 'trackSubscribed' ].forEach(event => {
      it(`should eventually raise a "${event}" event with the unpublished LocalVideoTrack`, () => {
        const thatTrack = thatTracksPublished[event];
        assert.equal(thatTrack.sid, thisPublishedTrack2.sid)
        assert.equal(thatTrack.id, thisPublishedTrack2.id);
        assert.equal(thatTrack.kind, thisPublishedTrack2.kind);
        assert.equal(thatTrack.enabled, thisPublishedTrack2.enabled);
        assert.equal(thatTrack.mediaStreamTrack.readyState, thisTrack2.mediaStreamTrack.readyState);
      });
    });

    it('should eventually raise a "trackStarted" event for the published LocalVideoTrack', async () => {
      await trackStarted(thatTrackAdded);
    });
  });

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/81
  //
  describe('#publishTrack called twice with two different LocalTracks in quick succession', () => {
    let thisRoom;
    let thisParticipant;
    let thisAudioTrack;
    let thisPublishedAudioTrack;
    let thisPublishedVideoTrack;
    let thisVideoTrack;
    let thatRoom;
    let thatParticipant;
    let thoseAudioTracks;
    let thoseVideoTracks;

    before(async () => {
      const name = randomName();
      const constraints = { audio: true, video: true, fake: true };

      // Answerer
      const thoseOptions = Object.assign({ name, tracks: [] }, defaultOptions);
      thatRoom = await connect(getToken(randomName()), thoseOptions);

      [thisAudioTrack, thisVideoTrack] = await createLocalTracks(constraints);

      // Offerer
      const theseOptions = Object.assign({ name, tracks: [] }, defaultOptions);
      thisRoom = await connect(getToken(randomName()), theseOptions);
      thisParticipant = thisRoom.localParticipant;

      await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
      thatParticipant = thatRoom.participants.get(thisParticipant.sid);
      assert(thatParticipant);

      // NOTE(mroberts): Wait 5 seconds.
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));

      let thoseTracksAdded;
      let thoseTracksSubscribed;
      [ thisPublishedAudioTrack, thisPublishedVideoTrack, thoseTracksAdded, thoseTracksSubscribed] =  await Promise.all([
        thisParticipant.publishTrack(thisAudioTrack),
        thisParticipant.publishTrack(thisVideoTrack),
        waitForTracks('trackAdded', thatParticipant, 2),
        waitForTracks('trackSubscribed', thatParticipant, 2)
      ]);

      const findTrack = (tracks, kind) => tracks.find(track => track.kind === kind);

      thoseAudioTracks = {
        trackAdded: findTrack(thoseTracksAdded, 'audio'),
        trackSubscribed: findTrack(thoseTracksSubscribed, 'audio')
      };
      thoseVideoTracks = {
        trackAdded: findTrack(thoseTracksAdded, 'video'),
        trackSubscribed: findTrack(thoseTracksSubscribed, 'video')
      };
    });

    after(() => {
      thisAudioTrack.stop();
      thisVideoTrack.stop();
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    [ 'trackAdded', 'trackSubscribed' ].forEach(event => {
      it(`should eventually raise a "${event}" event for each published LocalTracks`, () => {
        const thatAudioTrack = thoseAudioTracks[event];
        assert.equal(thatAudioTrack.sid, thisPublishedAudioTrack.sid);
        assert.equal(thatAudioTrack.id, thisPublishedAudioTrack.id);
        assert.equal(thatAudioTrack.kind, thisPublishedAudioTrack.kind);
        assert.equal(thatAudioTrack.enabled, thisPublishedAudioTrack.enabled);
        assert.equal(thatAudioTrack.mediaStreamTrack.readyState, thisAudioTrack.mediaStreamTrack.readyState);

        const thatVideoTrack = thoseVideoTracks[event];
        assert.equal(thatVideoTrack.sid, thisPublishedVideoTrack.sid);
        assert.equal(thatVideoTrack.id, thisPublishedVideoTrack.id);
        assert.equal(thatVideoTrack.kind, thisPublishedVideoTrack.kind);
        assert.equal(thatVideoTrack.enabled, thisPublishedVideoTrack.enabled);
        assert.equal(thatVideoTrack.mediaStreamTrack.readyState, thisVideoTrack.mediaStreamTrack.readyState);
      });
    });

    it('should eventually raise a "trackStarted" event for each published LocalTrack', async () => {
      const thatAudioTrack = thoseAudioTracks['trackAdded'];
      const thatVideoTrack = thoseVideoTracks['trackAdded'];
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
        [undefined, null, 25000],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
      ],
      [
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
      let thisRoom;
      let thoseRooms;

      before(async () => {
        const options = Object.assign({name: randomName()}, initialEncodingParameters, defaultOptions);
        const token = getToken(randomName());
        thisRoom = await connect(token, options);

        const thoseOptions = Object.assign({name: options.name}, defaultOptions);
        const thoseTokens = [randomName(), randomName()].map(getToken);
        thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

        await participantsConnected(thisRoom, thoseRooms.length);
        const thoseParticipants = [...thisRoom.participants.values()];
        await Promise.all(thoseParticipants.map(participant => tracksAdded(participant, 2)));
        peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
        thisRoom.localParticipant.setParameters(encodingParameters);

        const getRemoteDescription = pc => Object.keys(encodingParameters).length > 0
          ? new Promise(resolve => {
            const pcSetRemoteDescription = pc.setRemoteDescription;
            pc.setRemoteDescription = function setRemoteDescription(description) {
              resolve(description);
              pc.setRemoteDescription = pcSetRemoteDescription;
              return pcSetRemoteDescription.call(this, description);
            };
          })
          : Promise.resolve(pc.remoteDescription);

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
          flatMap(remoteDescriptions, description => {
            return getMediaSections(description.sdp, kind, '(recvonly|sendrecv)');
          }).forEach(section => {
            const modifier = guessBrowser() === 'firefox'
              ? 'TIAS'
              : 'AS';
            var maxBitrate = action === 'preserve'
              ? initialEncodingParameters[`max${capitalize(kind)}Bitrate`]
              : maxBitrates[kind];

            maxBitrate = maxBitrate
              ? guessBrowser() === 'firefox'
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
        [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
      });
    });
  });
});
