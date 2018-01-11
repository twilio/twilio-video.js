import * as assert from 'assert';
import VideoDriver, { TwilioError } from '../../../src/videodriver';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { capitalize, combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM || 'prod';
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
    ], async ([ browser, shouldConnectSucceed ]) => {
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
        videoDriver.close();
      });
    });
  });

  ['audio', 'data', 'video'].forEach(kind => {
    describe(`#createLocal${capitalize(kind)}Track`, () => {
      ['chrome', 'firefox'].forEach(browser => {
        context(browser, () => {
          let name: string;
          let serializedLocalTrack: any;
          let videoDriver: VideoDriver;

          before(async () => {
            name = randomName();
            videoDriver = new VideoDriver({ browser, realm, version });
            serializedLocalTrack = await videoDriver[`createLocal${capitalize(kind)}Track`]({ name });
          });

          it(`should return a serialized Local${capitalize(kind)}Track`, () => {
            assert(serializedLocalTrack);
            assert.equal(typeof serializedLocalTrack.id, 'string');
            assert.equal(serializedLocalTrack.kind, kind);
            assert.equal(serializedLocalTrack.name, name);
          });

          after(() => {
            videoDriver.close();
          });
        });
      });
    });
  });

  describe('#createLocalTracks', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let options: any;
        let serializedLocalTracks: any;
        let videoDriver: VideoDriver;

        before(async () => {
          options = { audio: { name: randomName() }, video: { name: randomName() } };
          videoDriver = new VideoDriver({ browser, realm, version });
          serializedLocalTracks = await videoDriver.createLocalTracks(options);
        });

        it(`should return an array of serialized LocalMediaTracks`, () => {
          assert(serializedLocalTracks);
          serializedLocalTracks.forEach(track => {
            assert.equal(typeof track.id, 'string');
            assert(/^audio|video$/.test(track.kind));
            assert.equal(track.name, options[track.kind].name);
          });
        });

        after(() => {
          videoDriver.close();
        });
      });
    });
  });
});
