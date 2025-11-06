import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import LocalMediaTrackDriver from '../../../src/videodriver/localmediatrack';
import RemoteMediaTrackDriver from '../../../src/videodriver/remotemediatrack';
import RemoteParticipantDriver from '../../../src/videodriver/remoteparticipant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { capitalize, combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('RemoteMediaTrackDriver', function() {
  this.timeout(60000);

  describe('events', () => {
    combinationContext([
      [
        ['disabled', 'enabled', 'started', 'unsubscribed'],
        x => x
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant publishing the LocalMediaTrack is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant subscribing to the RemoteMediaTrack is in ${x}`
      ]
    ], ([event, ...browsers]) => {
      let localMediaTrack: LocalMediaTrackDriver;
      let remoteMediaTrack: RemoteMediaTrackDriver;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;
      let waitForTrackEvent: Promise<void>;
      let waitForParticipantEvent: Promise<RemoteMediaTrackDriver>;
      let waitForRoomEvent: Promise<[RemoteMediaTrackDriver, RemoteParticipantDriver]>;

      before(async () => {
        const identities: Array<string> = browsers.map(randomName);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers = await Promise.all(tokens.map((token, i) => videoDrivers[i].connect(token, {
          ...defaults,
          name,
          tracks: []
        })));

        const participant: RemoteParticipantDriver = roomDrivers[1].participants.size > 0
          ? Array.from(roomDrivers[1].participants.values())[0]
          : await new Promise(resolve => roomDrivers[1].once('participantConnected', resolve));

        waitForParticipantEvent = new Promise(resolve => {
          participant.once(`track${capitalize(event)}`, resolve);
        });

        waitForRoomEvent = new Promise(resolve => {
          roomDrivers[1].once(`track${capitalize(event)}`, (track, participant) => resolve([track, participant]));
        });

        localMediaTrack = await videoDrivers[0].createLocalAudioTrack();
        const { localParticipant } = roomDrivers[0];
        await localParticipant.publishTrack(localMediaTrack);

        remoteMediaTrack = participant.tracks.size > 0
          ? Array.from(participant.tracks.values())[0]
          : await new Promise(resolve => participant.once('trackSubscribed', resolve));

        waitForTrackEvent = event === 'started' && remoteMediaTrack.isStarted ? Promise.resolve() : new Promise(resolve => {
          remoteMediaTrack.once(event, resolve);
        });

        switch (event) {
          case 'disabled':
            await localMediaTrack.disable();
            break;
          case 'enabled':
            await Promise.all([
              localMediaTrack.disable(),
              new Promise(resolve => remoteMediaTrack.once('disabled', resolve))
            ]);
            await localMediaTrack.enable();
            break;
          case 'unsubscribed':
            await localParticipant.unpublishTrack(localMediaTrack);
            break;
        }
      });

      it(`should emit "${event}" on the RemoteMediaTrackDriver`, async () => {
        await waitForTrackEvent;
        switch (event) {
          case 'disabled':
            assert.equal(remoteMediaTrack.isEnabled, false);
            break;
          case 'enabled':
            assert.equal(remoteMediaTrack.isEnabled, true);
            break;
          case 'started':
            assert.equal(remoteMediaTrack.isStarted, true);
            break;
          case 'unsubscribed':
            assert.equal(remoteMediaTrack.isSubscribed, false);
        }
      });

      it(`should emit "track${capitalize(event)}" on the RemoteParticipantDriver with the RemoteMediaTrackDriver`, async () => {
        const remoteTrack: RemoteMediaTrackDriver = await waitForParticipantEvent;
        assert(remoteTrack instanceof RemoteMediaTrackDriver);
        assert.equal(remoteTrack, remoteMediaTrack);
      });

      it(`should emit "track${capitalize(event)}" on the RoomDriver with the RemoteMediaTrackDriver `
        + 'and the RemoteParticipantDriver', async () => {
        const [remoteTrack, remoteParticipant] = await waitForRoomEvent;
        assert(remoteTrack instanceof RemoteMediaTrackDriver);
        assert.equal(remoteTrack, remoteMediaTrack);
        assert(remoteParticipant instanceof RemoteParticipantDriver);
        assert.equal(remoteParticipant, Array.from(roomDrivers[1].participants.values())[0]);
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
