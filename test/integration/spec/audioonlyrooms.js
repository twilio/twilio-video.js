'use strict';

const assert = require('assert');

const createLocalTracks = require('../../../es5/createlocaltracks');
const { RoomTrackKindNotSupportedError } = require('../../../es5/util/twilio-video-errors');
const LocalDataTrack = require('../../../es5/media/track/es5/localdatatrack');
const LocalTrackPublication = require('../../../es5/media/track/localtrackpublication');
const { completeRoom } = require('../../lib/rest');

const {
  setupAliceAndBob,
  smallVideoConstraints,
  tracksSubscribed,
  waitFor
} = require('../../lib/util');

// TODO(mmalavalli): Enable once Audio Only Rooms is available.
// const { topology } = require('../../lib/defaults');
// (topology === 'group' ? describe : describe.skip)('Audio Only Rooms', function() {
describe.skip('Audio Only Rooms', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  ['connect', 'publishTrack'].forEach(api => {
    describe(`${api}(), when called with audio, video and data Tracks`, () => {
      let aliceLocal;
      let aliceRemote;
      let aliceRoom;
      let bobRoom;
      let publicationError;
      let publicationsOrErrors;
      let roomSid;
      let tracks;

      before(async () => {
        tracks = [
          ...(await createLocalTracks({ audio: true, video: smallVideoConstraints, fake: true })),
          new LocalDataTrack()
        ];

        ({ aliceLocal, aliceRemote, aliceRoom, bobRoom, roomSid } = await setupAliceAndBob({
          aliceOptions: { tracks: { connect: tracks, publishTrack: [] }[api] },
          bobOptions: { tracks: [] },
          onAliceConnected: ({ localParticipant }) => localParticipant.once('trackPublicationFailed', error => {
            publicationError = error;
          }),
          roomOptions: { AudioOnly: true },
          waitForMediaConnection: false
        }));

        if (api === 'publishTrack') {
          publicationsOrErrors = await waitFor(tracks.map(async track => {
            let publicationOrError;
            try {
              publicationOrError = await aliceLocal.publishTrack(track);
            } catch (error) {
              publicationOrError = error;
            }
            return publicationOrError;
          }), 'Tracks to be published or failed');
        }
        return tracksSubscribed(aliceRemote, tracks.length - 1);
      });

      after(async () => {
        [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
        tracks.forEach(track => track.stop && track.stop());
        if (roomSid) {
          await completeRoom(roomSid);
        }
      });

      if (api === 'connect') {
        it('should successfully connect to the Room', () => {
          assert(!!aliceRoom);
          assert(!!bobRoom);
        });
      }

      it('should successfully publish the audio and data Tracks', () => {
        const publications = [...aliceLocal.tracks.values()];
        assert.strictEqual(publications.length, tracks.length - 1);
        publications.forEach(({ kind, track }) => {
          assert.notStrictEqual(kind, 'video');
          assert.strictEqual(track, tracks.find(track => track.kind === kind));
        });
        if (api === 'publishTrack') {
          const published = publicationsOrErrors.filter(publication => publication instanceof LocalTrackPublication);
          assert.strictEqual(published.length, tracks.length - 1);
          published.forEach(({ kind, track }) => {
            assert.notStrictEqual(kind, 'video');
            assert.strictEqual(track, tracks.find(track => track.kind === kind));
          });
        }
      });

      it('should fail to publish the video Track with error code 53125', () => {
        if (api === 'connect') {
          assert(publicationError instanceof RoomTrackKindNotSupportedError);
          assert.strictEqual(publicationError.code, 53125);
        } else if (api === 'publishTrack') {
          const publishError = publicationsOrErrors.find(publicationOrError => !(publicationOrError instanceof LocalTrackPublication));
          assert(publishError instanceof RoomTrackKindNotSupportedError);
          assert.strictEqual(publishError.code, 53125);
        }
      });

      it('should be able to subscribe to the audio and data Tracks, but not the video Track', () => {
        assert.strictEqual(aliceRemote.tracks.size, tracks.length - 1);
        aliceRemote.tracks.forEach(({ kind }) => assert.notStrictEqual(kind, 'video'));
      });
    });
  });
});
