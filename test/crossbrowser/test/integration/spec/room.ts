import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import LocalDataTrackDriver from '../../../src/videodriver/localdatatrack';
import LocalMediaTrackDriver from '../../../src/videodriver/localmediatrack';
import LocalTrackPublicationDriver from '../../../src/videodriver/localtrackpublication';
import RemoteDataTrackDriver from '../../../src/videodriver/remotedatatrack';
import RemoteMediaTrackDriver from '../../../src/videodriver/remotemediatrack';
import RemoteParticipantDriver from '../../../src/videodriver/remoteparticipant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('RoomDriver', function() {
  this.timeout(60000);

  describe('#disconnect', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let roomDriver: RoomDriver;
        let videoDriver: VideoDriver;

        before(async () => {
          const name: string = randomName();
          videoDriver = new VideoDriver({ browser, realm, version });
          roomDriver = await videoDriver.connect(getToken(browser), { ...defaults, name });
        });

        it('should disconnect from the Room in the browser', async () => {
          roomDriver.disconnect();
          const disconnectedRoomDriver: RoomDriver = await new Promise(resolve => {
            roomDriver.once('disconnected', resolve);
          });
          assert(disconnectedRoomDriver, roomDriver);
          assert(roomDriver.state, 'disconnected');
        });

        after(() => {
          if (videoDriver) {
            videoDriver.close();
          }
        });
      });
    });
  });

  describe('#getStats', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let name: string;
        let roomDrivers: Array<RoomDriver>;
        let stats: Array<any>;
        let videoDriver: VideoDriver;

        before(async () => {
          const constraints: Array<any> = [{ audio: true }, { video: true }];
          const tokens: Array<string> = [randomName(), randomName()].map(getToken);

          name = randomName();
          videoDriver = new VideoDriver({ browser, realm, version });

          roomDrivers = await Promise.all(tokens.map((token, i) => {
            return videoDriver.connect(token, {
              ...defaults,
              ...constraints[i],
              name
            });
          }));

          // Wait for a second for WebRTC stats to be generated.
          await new Promise(resolve => setTimeout(resolve, 1000));

          stats = await Promise.all(roomDrivers.map(roomDriver => roomDriver.getStats()));
        });

        it('should resolve with WebRTC stats for the appropriate Tracks for the first Participant', () => {
          const { localParticipant: { audioTracks } } = roomDrivers[0];
          const { localParticipant: { videoTracks } } = roomDrivers[1];
          const [{
            localAudioTrackStats,
            localVideoTrackStats,
            remoteAudioTrackStats,
            remoteVideoTrackStats
          }] = stats[0];

          assert.equal(localAudioTrackStats.length, 1);
          assert.equal(localAudioTrackStats[0].trackId, Array.from(audioTracks.values())[0].id);
          assert.equal(localVideoTrackStats.length, 0);

          assert.equal(remoteAudioTrackStats.length, 0);
          assert.equal(remoteVideoTrackStats.length, 1);
          assert.equal(remoteVideoTrackStats[0].trackId, Array.from(videoTracks.values())[0].id);
        });

        it('should resolve with WebRTC stats for the appropriate Tracks for the second Participant', () => {
          const { localParticipant: { audioTracks } } = roomDrivers[0];
          const { localParticipant: { videoTracks } } = roomDrivers[1];
          const [{
            localAudioTrackStats,
            localVideoTrackStats,
            remoteAudioTrackStats,
            remoteVideoTrackStats
          }] = stats[1];

          assert.equal(localAudioTrackStats.length, 0);
          assert.equal(localVideoTrackStats.length, 1);
          assert.equal(localVideoTrackStats[0].trackId, Array.from(videoTracks.values())[0].id);

          assert.equal(remoteAudioTrackStats.length, 1);
          assert.equal(remoteAudioTrackStats[0].trackId, Array.from(audioTracks.values())[0].id);
          assert.equal(remoteVideoTrackStats.length, 0);
        });

        after(() => {
          if (roomDrivers) {
            roomDrivers.forEach(roomDriver => roomDriver.disconnect());
          }
          if (videoDriver) {
            videoDriver.close();
          }
        });
      });
    });
  });

  describe('events', () => {
    combinationContext([
      [
        ['participantConnected', 'participantDisconnected'],
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
        const tokens: Array<string> = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const participantEvent: Promise<RemoteParticipantDriver> = new Promise(resolve => {
          roomDrivers[0].once(event, resolve);
        });

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        if (event === 'participantDisconnected') {
          roomDrivers[1].disconnect();
        }
        participantDriver = await participantEvent;
      });

      it(`should emit "${event}" on the first Participant with a RemoteParticipantDriver for the second Participant`, () => {
        assert(participantDriver instanceof RemoteParticipantDriver);
        assert.equal(participantDriver.identity, roomDrivers[1].localParticipant.identity);
        assert.equal(participantDriver.sid, roomDrivers[1].localParticipant.sid);

        assert(event === 'participantConnected'
          ? roomDrivers[0].participants.has(participantDriver.sid)
          : !roomDrivers[0].participants.has(participantDriver.sid));
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
          await new Promise(resolve => roomDrivers[0].once(shouldRemoveTracks ? 'trackSubscribed' : event, resolve));
        }

        const { localParticipant } = roomDrivers[1];
        localTracks = Array.from(localParticipant.tracks.values());

        if (shouldRemoveTracks) {
          remoteTracks = [];

          for (let track of localTracks) {
            const trackEvent: Promise<any> = new Promise(resolve => roomDrivers[0].once(event, resolve));
            await localParticipant.unpublishTrack(track);
            remoteTracks.push(await trackEvent);
          };

          return;
        }

        remoteTracks = Array.from(participantDriver.tracks.values());
      });

      it(`should emit "${event}" events on the first RemoteParticipantDriver with RemoteTrackDrivers`, () => {
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
          assert(publication instanceof LocalTrackPublicationDriver);
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
