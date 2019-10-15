'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../lib');

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
  participantsConnected,
  randomName,
  tracksSubscribed,
  tracksUnpublished,
  waitForTracks,
  waitFor
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
});
