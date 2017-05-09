'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const getToken = require('../../lib/token');
const env = require('../../env');
const { flatMap } = require('../../../lib/util');
const Track = require('../../../lib/media/track');

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

const isFirefox = navigator.userAgent.indexOf("Firefox") > 0;

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
      if (!isFirefox) {
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
});
