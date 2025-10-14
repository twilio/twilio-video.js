import * as assert from 'assert';
import VideoDriver, { TwilioError } from '../../../src/videodriver';
import LocalDataTrackDriver from '../../../src/videodriver/localdatatrack';
import LocalMediaTrackDriver from '../../../src/videodriver/localmediatrack';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { capitalize, combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('VideoDriver', function() {
  this.timeout(60000);

  describe('#connect', () => {
    combinationContext([
      [
        ['chrome', 'firefox'],
        x => x
      ],
      [
        [true, false],
        x => `when ${x ? 'successful' : 'unsuccessful'}`
      ]
    ], async ([browser, shouldConnectSucceed]) => {
      let error: TwilioError;
      let name: string;
      let roomDriver: RoomDriver;
      let token: 'string';
      let videoDriver: VideoDriver;

      before(async () => {
        name = randomName();
        token = shouldConnectSucceed ? getToken(browser) : 'foo';
        videoDriver = new VideoDriver({ browser, realm, version });

        try {
          roomDriver = await videoDriver.connect(token, { ...defaults, name });
        } catch (e) {
          error = e;
        }
      });

      it(`should ${shouldConnectSucceed ? 'resolve with a RoomDriver' : 'reject with a TwilioError'}`, () => {
        if (shouldConnectSucceed) {
          assert(roomDriver instanceof RoomDriver);
          assert.equal(roomDriver.name, name);
          assert.equal(roomDriver.state, 'connected');
          return;
        }

        assert(error instanceof Error);
        assert(typeof error.code, 'number');
        assert(typeof error.message, 'string');
      });

      after(() => {
        if (roomDriver) {
          roomDriver.disconnect();
        }
        if (videoDriver) {
          videoDriver.close();
        }
      });
    });
  });

  ['audio', 'data', 'video'].forEach(kind => {
    describe(`#createLocal${capitalize(kind)}Track`, () => {
      ['chrome', 'firefox'].forEach(browser => {
        context(browser, () => {
          let name: string;
          let localTrack: LocalDataTrackDriver | LocalMediaTrackDriver;
          let videoDriver: VideoDriver;

          before(async () => {
            name = randomName();
            videoDriver = new VideoDriver({ browser, realm, version });
            localTrack = await videoDriver[`createLocal${capitalize(kind)}Track`]({ name });
          });

          it(`should return a Local${kind === 'data' ? 'Data' : 'Media'}TrackDriver`, () => {
            assert(kind === 'data'
              ? localTrack instanceof LocalDataTrackDriver
              : localTrack instanceof LocalMediaTrackDriver);

            assert.equal(typeof localTrack.id, 'string');
            assert.equal(localTrack.kind, kind);
            assert.equal(localTrack.name, name);
          });

          after(() => {
            if (videoDriver) {
              videoDriver.close();
            }
          });
        });
      });
    });
  });

  describe('#createLocalTracks', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let options: any;
        let localTracks: Array<LocalMediaTrackDriver>;
        let videoDriver: VideoDriver;

        before(async () => {
          options = { audio: { name: randomName() }, video: { name: randomName() } };
          videoDriver = new VideoDriver({ browser, realm, version });
          localTracks = await videoDriver.createLocalTracks(options);
        });

        it('should return an array of LocalMediaTrackDrivers', () => {
          assert(localTracks);
          localTracks.forEach(track => {
            assert(track instanceof LocalMediaTrackDriver);
            assert.equal(typeof track.id, 'string');
            assert(/^audio|video$/.test(track.kind));
            assert.equal(track.name, options[track.kind].name);
          });
        });

        after(() => {
          if (videoDriver) {
            videoDriver.close();
          }
        });
      });
    });
  });
});
