import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import LocalDataTrackDriver from '../../../src/videodriver/localdatatrack';
import RemoteDataTrackDriver from '../../../src/videodriver/remotedatatrack';
import RemoteParticipantDriver from '../../../src/videodriver/remoteparticipant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { capitalize, combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('RemoteDataTrackDriver', function() {
  this.timeout(60000);

  describe('events', () => {
    combinationContext([
      [
        ['message', 'unsubscribed'],
        x => x
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant publishing the LocalDataTrack is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant subscribing to the RemoteDataTrack is in ${x}`
      ]
    ], ([event, ...browsers]) => {
      let localDataTrack: LocalDataTrackDriver;
      let remoteDataTrack: RemoteDataTrackDriver;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;
      let waitForTrackEvent: Promise<void>;
      let waitForParticipantEvent: Promise<RemoteDataTrackDriver>;
      let waitForRoomEvent: Promise<[RemoteDataTrackDriver, RemoteParticipantDriver]>;

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

        localDataTrack = await videoDrivers[0].createLocalDataTrack();
        const { localParticipant } = roomDrivers[0];
        await localParticipant.publishTrack(localDataTrack);

        remoteDataTrack = participant.tracks.size > 0
          ? Array.from(participant.tracks.values())[0]
          : await new Promise(resolve => participant.once('trackSubscribed', resolve));

        waitForTrackEvent = new Promise(resolve => {
          remoteDataTrack.once(event, resolve);
        });

        waitForParticipantEvent = new Promise(resolve => {
          participant.once(`track${capitalize(event)}`, function() {
            resolve([].slice.call(arguments));
          });
        });

        waitForRoomEvent = new Promise(resolve => {
          roomDrivers[1].once(`track${capitalize(event)}`, function() {
            resolve([].slice.call(arguments));
          });
        });

        switch (event) {
          case 'message':
            await localDataTrack.send('foo');
            break;
          case 'unsubscribed':
            await localParticipant.unpublishTrack(localDataTrack);
            break;
        }
      });

      it(`should emit "${event}" on the RemoteDataTrackDriver`, async () => {
        const data: any = await waitForTrackEvent;
        if (event === 'message') {
          assert.equal(data, 'foo');
        }
      });

      it(`should emit "track${capitalize(event)}" on the RemoteParticipantDriver with the RemoteDataTrackDriver`, async () => {
        const data: any = await waitForParticipantEvent;
        if (event === 'message') {
          assert.equal(data.shift(), 'foo');
        }
        assert(data[0] instanceof RemoteDataTrackDriver);
        assert.equal(data[0], remoteDataTrack);
      });

      it(`should emit "track${capitalize(event)}" on the RoomDriver with the RemoteDataTrackDriver `
        + 'and the RemoteParticipantDriver', async () => {
        const data: any = await waitForRoomEvent;
        if (event === 'message') {
          assert.equal(data.shift(), 'foo');
        }
        assert(data[0] instanceof RemoteDataTrackDriver);
        assert.equal(data[0], remoteDataTrack);
        assert(data[1] instanceof RemoteParticipantDriver);
        assert.equal(data[1], Array.from(roomDrivers[1].participants.values())[0]);
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
