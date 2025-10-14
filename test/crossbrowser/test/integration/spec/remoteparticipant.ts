import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import RemoteParticipantDriver from '../../../src/videodriver/remoteparticipant';
import LocalDataTrackDriver from '../../../src/videodriver/localdatatrack';
import LocalMediaTrackDriver from '../../../src/videodriver/localmediatrack';
import RemoteDataTrackDriver from '../../../src/videodriver/remotedatatrack';
import RemoteMediaTrackDriver from '../../../src/videodriver/remotemediatrack';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('RemoteParticipantDriver', function() {
  this.timeout(60000);

  describe('events', () => {
    combinationContext([
      [
        ['disconnected'],
        x => `"${x}"`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the first Participant is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the second Participant is in ${x}`
      ]
    ], ([event, ...browsers]) => {
      let participantDriver: RemoteParticipantDriver;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map(randomName);
        const name: string = randomName();
        const tokens: string = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const participantEvent: Promise<RemoteParticipantDriver> = new Promise(resolve => {
          roomDrivers[0].once('participantConnected', (participantDriver: RemoteParticipantDriver) => {
            participantDriver.once(event, resolve);
          });
        });

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        roomDrivers[1].disconnect();
        participantDriver = await participantEvent;
      });

      it(`should emit "${event}" on the RemoteParticipantDriver`, () => {
        assert(participantDriver instanceof RemoteParticipantDriver);
        assert.equal(participantDriver.identity, roomDrivers[1].localParticipant.identity);
        assert.equal(participantDriver.sid, roomDrivers[1].localParticipant.sid);
        assert.equal(participantDriver.state, event);
      });

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });

    combinationContext([
      [
        ['trackAdded', 'trackRemoved', 'trackSubscribed', 'trackUnsubscribed'],
        x => `"${x}"`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the first Participant is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the second Participant is in ${x}`
      ]
    ], ([event, ...browsers]) => {
      const shouldRemoveTracks = /^track(Removed|Unsubscribed)$/.test(event);
      let roomDrivers: Array<RoomDriver>;
      const localTracks: Array<LocalDataTrackDriver | LocalMediaTrackDriver>;
      let remoteTracks: Array<RemoteDataTrackDriver | RemoteMediaTrackDriver>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map(randomName);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers = await Promise.all(tokens.map((token, i) => videoDrivers[i].connect(token, {
          ...defaults,
          name
        })));

        const { participants } = roomDrivers[0];
        while (participants.size < browsers.length - 1) {
          await new Promise(resolve => roomDrivers[0].once('participantConnected', resolve));
        }

        const participantDriver: RemoteParticipantDriver = Array.from(participants.values())[0];
        while (participantDriver.tracks.size < roomDrivers[1].localParticipant.tracks.size) {
          await new Promise(resolve => participantDriver.once(shouldRemoveTracks ? 'trackSubscribed' : event, resolve));
        }

        const { localParticipant } = roomDrivers[1];
        localTracks = Array.from(localParticipant.tracks.values());

        if (shouldRemoveTracks) {
          remoteTracks = [];

          for (let track of localTracks) {
            const trackEvent: Promise<RemoteDataTrackDriver | RemoteMediaTrackDriver> = new Promise(resolve => {
              participantDriver.once(event, resolve);
            });
            await localParticipant.unpublishTrack(track);
            remoteTracks.push(await trackEvent);
          };

          return;
        }

        remoteTracks = Array.from(participantDriver.tracks.values());
      });

      it(`should emit "${event}" events on the first RemoteParticipantDriver with the RemoteTrackDrivers`, () => {
        assert.equal(remoteTracks.length, localTracks.length);

        remoteTracks.forEach((track, i) => {
          assert(track.kind === 'data'
            ? track instanceof RemoteDataTrackDriver
            : track instanceof RemoteMediaTrackDriver);

          ['id, kind', 'name'].forEach(prop => {
            assert.equal(track[prop], localTracks[i][prop]);
          });
        });

        if (shouldRemoveTracks) {
          return;
        }
        const { localParticipant: { trackPublications } } = roomDrivers[1];

        remoteTracks.forEach(track => {
          const participantDriver: RemoteParticipantDriver = Array.from(roomDrivers[0].participants.values())[0];
          const publication: string = trackPublications.get(track.sid);
          assert.equal(track.sid, publication.trackSid);
          assert(participantDriver.tracks.has(track.id));
          assert(participantDriver[`${track.kind}Tracks`].has(track.id));
        });
      });

      after(() => {
        if (roomDrivers) {
          roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        }
        if (videoDrivers) {
          videoDrivers.forEach(videoDriver => videoDriver.close());
        }
      });
    });
  });
});
