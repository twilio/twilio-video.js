import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
const { capitalize, combinationContext } = require('../../../../lib/util');

const { REALM, TOKEN, VERSION } = process.env;
const realm: string = REALM || 'prod';
const version: string = VERSION || '1.6.1';

describe('VideoDriver', function() {
  this.timeout(60000);

  describe('connect', () => {
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
      let serializedError: any;
      let serializedRoom: any;
      let token: 'string';
      let videoDriver: VideoDriver;

      before(async () => {
        token = shouldConnectSucceed ? TOKEN : 'foo';
        videoDriver = new VideoDriver({ browser, realm, version });

        try {
          serializedRoom = await videoDriver.connect(token, { name: 'my-cool-room' });
        } catch(e) {
          serializedError = e;
        }
      });

      it(`should return a serialized ${shouldConnectSucceed ? 'Room' : 'Error'}`, () => {
        if (shouldConnectSucceed) {
          assert(serializedRoom);
          assert.equal(serializedRoom.name, 'my-cool-room');
          assert.equal(serializedRoom.state, 'connected');
          return;
        }

        assert(serializedError);
        assert(typeof serializedError.code, 'number');
        assert(typeof serializedError.message, 'string');
      });

      after(() => {
        videoDriver.close();
      });
    });
  });

  ['audio', 'data', 'video'].forEach(kind => {
    describe(`createLocal${capitalize(kind)}Track`, () => {
      let serializedLocalTrack: any;
      let videoDriver: VideoDriver;

      ['chrome', 'firefox'].forEach(browser => {
        context(browser, () => {
          before(async () => {
            videoDriver = new VideoDriver({ browser, realm, version });
            serializedLocalTrack = await videoDriver[`createLocal${capitalize(kind)}Track`]({ name: 'my-cool-track' });
          });

          it(`should return a serialized Local${capitalize(kind)}Track`, () => {
            assert(serializedLocalTrack);
            assert.equal(typeof serializedLocalTrack.id, 'string');
            assert.equal(serializedLocalTrack.kind, kind);
            assert.equal(serializedLocalTrack.name, 'my-cool-track');
          });

          after(() => {
            videoDriver.close();
          });
        });
      });
    });
  });

  describe('createLocalTracks', () => {
    let serializedLocalTracks: any;
    let videoDriver: VideoDriver;

    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        before(async () => {
          videoDriver = new VideoDriver({ browser, realm, version });
          serializedLocalTracks = await videoDriver.createLocalTracks({
            audio: { name: 'my-cool-audio' },
            video: { name: 'my-cool-video' }
          });
        });

        it(`should return an array of serialized LocalMediaTracks`, () => {
          assert(serializedLocalTracks);
          serializedLocalTracks.forEach(track => {
            assert.equal(typeof track.id, 'string');
            assert(/^audio|video$/.test(track.kind));
            assert.equal(track.name, `my-cool-${track.kind}`);
          });
        });

        after(() => {
          videoDriver.close();
        });
      });
    });
  });
});
