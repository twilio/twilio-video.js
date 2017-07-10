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
  trackStarted
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

  describe('#addTrack', () => {
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
        x => `that has ${x} been added`
      ]
    ], ([isEnabled, kind, when]) => {
      let thisRoom;
      let thisParticipant;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thoseTracksBefore;
      let thoseTracks;

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
          thisParticipant.removeTrack(thisTrack, false);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksRemoved(thatParticipant, thisParticipant.tracks.size);
          }));
        }

        thisParticipant.addTrack(thisTrack);

        thoseTracks = await Promise.all(thoseParticipants.map(thatParticipant => {
          return new Promise(resolve => thatParticipant.once('trackAdded', resolve));
        }));
      });

      after(() => {
        thisTrack.stop();
        [thisRoom].concat(thoseRooms).forEach(room => room.disconnect());
      });

      it('should raise a "trackAdded" event on the corresponding Participants with a Track', () => {
        thoseTracks.forEach(thatTrack => assert(thatTrack instanceof Track));
      });

      describe('should raise a "trackAdded" event on the corresponding Participants with a Track and', () => {
        it('should set each Track\'s .id to the LocalTrack\'s .id', () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.id, thisTrack.id));
        });

        it(`should set each Track's .kind to "${kind}"`, () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
        });

        it(`should set each Track's .isEnabled state to ${isEnabled}`, () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
        });

        if (when === 'previously') {
          it('the Track should be a new Track instance, despite sharing the same .id as the previously-added Track', () => {
            assert.equal(thoseTracksBefore.length, thoseTracks.length);
            thoseTracksBefore.forEach((thatTrackBefore, i) => {
              const thatTrackAfter = thoseTracks[i];
              assert.equal(thatTrackAfter.id, thatTrackBefore.id);
              assert.equal(thatTrackAfter.kind, thatTrackBefore.kind);
              assert.equal(thatTrackAfter.enabled, thatTrackBefore.enabled);
              assert.notEqual(thatTrackAfter, thatTrackBefore);
            });
          });
        }
      });
    });
  });

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
            assert(typeof publishedTrack.sid, 'string');
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
  });
  
  describe('#removeTrack', () => {
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
        ['added', 'added, removed, and then added again'],
        x => 'that was ' + x
      ]
    ], ([isEnabled, kind, when]) => {
      let thisRoom;
      let thisParticipant;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thoseTracks;

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

        if (when !== 'added') {
          thisParticipant.removeTrack(thisTrack, false);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksRemoved(thatParticipant, thisParticipant.tracks.size);
          }));

          thisParticipant.addTrack(thisTrack);

          await Promise.all(thoseParticipants.map(thatParticipant => {
            return tracksAdded(thatParticipant, thisParticipant.tracks.size);
          }));
        }

        thisParticipant.removeTrack(thisTrack, false);

        thoseTracks = await Promise.all(thoseParticipants.map(thatParticipant => {
          return new Promise(resolve => thatParticipant.once('trackRemoved', resolve));
        }));
      });

      after(() => {
        thisTrack.stop();
        [thisRoom].concat(thoseRooms).forEach(room => room.disconnect());
      });

      it('should raise a "trackRemoved" event on the corresponding Participants with a Track', () => {
        thoseTracks.forEach(thatTrack => assert(thatTrack instanceof Track));
      });

      describe('should raise a "trackRemoved" event on the corresponding Participants with a Track and', () => {
        it('should set each Track\'s .id to the LocalTrack\'s .id', () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.id, thisTrack.id));
        });

        it(`should set each Track's .kind to "${kind}"`, () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
        });

        it(`should set each Track's .isEnabled state to ${isEnabled}`, () => {
          thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
        });
      });
    });
  });

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/72
  //
  describe('#removeTrack and #addTrack called with two different LocalVideoTracks in quick succession', () => {
    let thisRoom;
    let thisParticipant;
    let thisTrack1;
    let thisTrack2;
    let thatRoom;
    let thatParticipant;
    let thatTrack1;
    let thatTrack2;

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

      const trackRemoved = new Promise(resolve => thatParticipant.once('trackRemoved', resolve));
      const trackAdded = new Promise(resolve => thatParticipant.once('trackAdded', resolve));

      thisParticipant.removeTrack(thisTrack1);
      [thisTrack2] = await createLocalTracks(constraints);
      thisParticipant.addTrack(thisTrack2);

      [thatTrack1, thatTrack2] = await Promise.all([trackRemoved, trackAdded]);
    });

    after(() => {
      thisTrack2.stop();
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    it('should eventually raise a "trackRemoved" event with the removed LocalVideoTrack', () => {
      assert.equal(thatTrack1.id, thisTrack1.id);
      assert.equal(thatTrack1.kind, thisTrack1.kind);
      assert.equal(thatTrack1.enabled, thisTrack1.enabled);
      if (!isFirefox && !isSafari) {
        assert.equal(thatTrack1.mediaStreamTrack.readyState, 'ended');
      }
    });

    it('should eventually raise a "trackAdded" event with the added LocalVideoTrack', () => {
      assert.equal(thatTrack2.id, thisTrack2.id);
      assert.equal(thatTrack2.kind, thisTrack2.kind);
      assert.equal(thatTrack2.enabled, thisTrack2.enabled);
      assert.equal(thatTrack2.mediaStreamTrack.readyState, thisTrack2.mediaStreamTrack.readyState);
    });

    it('should eventually raise a "trackStarted" event for the added LocalVideoTrack', async () => {
      await trackStarted(thatTrack2);
    });
  });

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/81
  //
  describe('#addTrack called twice with two different LocalTracks in quick succession', () => {
    let thisRoom;
    let thisParticipant;
    let thisAudioTrack;
    let thisVideoTrack;
    let thatRoom;
    let thatParticipant;
    let thatAudioTrack;
    let thatVideoTrack;

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

      [thisAudioTrack, thisVideoTrack].forEach(thisParticipant.addTrack, thisParticipant);

      await tracksAdded(thatParticipant, 2);
      [thatAudioTrack] = [...thatParticipant.audioTracks.values()];
      [thatVideoTrack] = [...thatParticipant.videoTracks.values()];
    });

    after(() => {
      thisAudioTrack.stop();
      thisVideoTrack.stop();
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    it('should eventually raise a "trackAdded" event with the added LocalVideoTrack', () => {
      assert.equal(thatAudioTrack.id, thisAudioTrack.id);
      assert.equal(thatAudioTrack.kind, thisAudioTrack.kind);
      assert.equal(thatAudioTrack.enabled, thisAudioTrack.enabled);
      assert.equal(thatAudioTrack.mediaStreamTrack.readyState, thisAudioTrack.mediaStreamTrack.readyState);

      assert.equal(thatVideoTrack.id, thisVideoTrack.id);
      assert.equal(thatVideoTrack.kind, thisVideoTrack.kind);
      assert.equal(thatVideoTrack.enabled, thisVideoTrack.enabled);
      assert.equal(thatVideoTrack.mediaStreamTrack.readyState, thisVideoTrack.mediaStreamTrack.readyState);
    });

    it('should eventually raise a "trackStarted" event for each added LocalTrack', async () => {
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
