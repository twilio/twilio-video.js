'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../lib');

const RemoteAudioTrack = require('../../../lib/media/track/remoteaudiotrack');
const RemoteDataTrack = require('../../../lib/media/track/remotedatatrack');
const RemoteVideoTrack = require('../../../lib/media/track/remotevideotrack');
const { flatMap } = require('../../../lib/util');

const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  randomName,
  tracksAdded,
  tracksRemoved,
  waitForTracks
} = require('../../lib/util');

describe('LocalTrackPublication', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

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
      let thisRoom;
      let thisParticipant;
      let thisLocalTrackPublication;
      let thisTrack;
      let thoseRooms;
      let thoseParticipants;
      let thoseTracksRemoved;
      let thoseTracksUnsubscribed;
      let thoseTracksMap;
      let thoseUnsubscribed;

      before(async () => {
        const name = randomName();
        // TODO(mroberts): Update when VIDEO-954 is fixed.
        const identities = kind === 'data'
          ? [randomName(), randomName()]
          : [randomName(), randomName(), randomName()];
        const options = Object.assign({ name }, defaults);

        thisTrack = await {
          audio: createLocalAudioTrack,
          video: createLocalVideoTrack,
          data() { return new LocalDataTrack(); }
        }[kind]();

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

        thisLocalTrackPublication = [...thisParticipant.trackPublications.values()].find(trackPublication => {
          return trackPublication.track === thisTrack;
        });
        thisLocalTrackPublication.unpublish();

        thoseUnsubscribed = flatMap(thoseParticipants, participant => [...participant.tracks.values()]).map(track => {
          return new Promise(resolve => track.once('unsubscribed', resolve));
        });

        [thoseTracksRemoved, thoseTracksUnsubscribed] = await Promise.all(['trackRemoved', 'trackUnsubscribed'].map(event => {
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
        if (kind !== 'data') {
          thisTrack.stop();
        }
        [thisRoom].concat(thoseRooms).forEach(room => room.disconnect());
      });

      it('should raise "unsubscribed" events on the corresponding RemoteParticipants\' RemoteTracks', async () => {
        await thoseUnsubscribed;
      });

      ['trackRemoved', 'trackUnsubscribed'].forEach(event => {
        it(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack`, () => {
          const thoseTracks = thoseTracksMap[event];
          thoseTracks.forEach(thatTrack => assert(thatTrack instanceof {
            audio: RemoteAudioTrack,
            video: RemoteVideoTrack,
            data: RemoteDataTrack
          }[thatTrack.kind]));
        });

        describe(`should raise a "${event}" event on the corresponding RemoteParticipants with a RemoteTrack and`, () => {
          it('should set the RemoteTrack\'s .sid to the LocalTrackPublication\'s .trackSid', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.sid, thisLocalTrackPublication.trackSid));
          });

          it(`should set each RemoteTrack's .kind to "${kind}"`, () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.kind, kind));
          });

          if (kind !== 'data') {
            it(`should set each RemoteTrack's .isEnabled state to ${isEnabled}`, () => {
              const thoseTracks = thoseTracksMap[event];
              thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isEnabled, isEnabled));
            });
          }

          it('should set each RemoteTrack\'s .isSubscribed to false', () => {
            const thoseTracks = thoseTracksMap[event];
            thoseTracks.forEach(thatTrack => assert.equal(thatTrack.isSubscribed, false));
          });
        });
      });
    });
  });
});
