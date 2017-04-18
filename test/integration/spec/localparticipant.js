'use strict';

const assert = require('assert');
const getToken = require('../../lib/token');
const env = require('../../env');
const { flatMap } = require('../../../lib/util');
const Track = require('../../../lib/media/track');

const {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack
} = require('../../../lib');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  pairs,
  randomName,
  tracksAdded,
  tracksRemoved
} = require('../../lib/util');

const defaultOptions = ['ecsServer', 'logLevel', 'wsServer', 'wsServerInsights'].reduce((defaultOptions, option) => {
  if (env[option] !== undefined) {
    defaultOptions[option] = env[option];
  }
  return defaultOptions;
}, {});

(navigator.userAgent === 'Node'
  ? describe.skip
  : describe
)('LocalParticipant', function() {
  this.timeout(30000);

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
});
