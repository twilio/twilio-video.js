import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import ParticipantDriver from '../../../src/videodriver/participant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM || 'prod';
const version: string = VERSION || '1.6.1';

describe('ParticipantDriver', function() {
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
    ], ([ event, ...browsers ]) => {
      let participantDriver: ParticipantDriver;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map((browser, i) => `${browser}${i}`);
        const name: string = randomName();
        const tokens: string = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const participantEvent: Promise<ParticipantDriver> = new Promise(resolve => {
          roomDrivers[0].once('participantConnected', (participantDriver: ParticipantDriver) => {
            participantDriver.once(event, resolve);
          });
        });

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        roomDrivers[1].disconnect();
        participantDriver = await participantEvent;
      });

      it(`should emit "${event}" on the ParticipantDriver`, () => {
        assert(participantDriver instanceof ParticipantDriver);
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
        ['trackAdded', 'trackSubscribed'],
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
    ], ([ event, ...browsers ]) => {
      let roomDrivers: Array<RoomDriver>;
      let serializedTracks: Array<any>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map((browser, i) => `${browser}${i}`);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const trackEvents: Promise<Array<Any>> = (async () => {
          const participantDriver: ParticipantDriver = await new Promise(resolve => {
            roomDrivers[0].once('participantConnected', resolve);
          });
          return new Promise(resolve => {
            participantDriver.on(event, () => {
              if (participantDriver.tracks.size === 2) {
                resolve(Array.from(participantDriver.tracks.values()));
              }
            });
          });
        })();

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        serializedTracks = await trackEvents;
      });

      it(`should emit "${event}" events on the first ParticipantDriver with serialized RemoteTracks`, () => {
        const { localParticipant: { trackPublications, tracks } } = roomDrivers[1];
        assert.equal(serializedTracks.length, 2);

        serializedTracks.forEach((serializedRemoteTrack: any) => {
          const participantDriver: ParticipantDriver = Array.from(roomDrivers[0].participants.values())[0];
          const track: any = tracks.find(track => serializedRemoteTrack.id === track.id);
          const publication: string = trackPublications.find(publication => track.id === publication.track.id);

          ['id, kind', 'name'].forEach(prop => assert.equal(serializedRemoteTrack[prop], track[prop]));
          assert.equal(serializedRemoteTrack.sid, publication.trackSid);
          assert(participantDriver.tracks.has(serializedRemoteTrack.id));
          assert(participantDriver[`${serializedRemoteTrack.kind}Tracks`].has(serializedRemoteTrack.id));
        });
      });

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });
  });
});
