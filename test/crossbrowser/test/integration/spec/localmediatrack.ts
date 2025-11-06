import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import LocalMediaTrackDriver from '../../../src/videodriver/localmediatrack';
const { combinationContext } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM;
const version: string = VERSION;

describe('LocalMediaTrackDriver', function() {
  this.timeout(60000);

  combinationContext([
    [
      ['disable', 'enable', 'stop'],
      x => `#${x}`
    ],
    [
      ['chrome', 'firefox'],
      x => x
    ]
  ], ([method, browser]) => {
    const event: string = method === 'stop' ? 'stopped' : `${method}d`;
    const expected: boolean = new Set(['stop', 'enable']).has(method);
    const prop: string = method === 'stop' ? 'isStopped' : 'isEnabled';
    let localMediaTrack: LocalMediaTrackDriver;
    let videoDriver: VideoDriver;
    let waitForEvent: Promise<void>;

    before(async () => {
      videoDriver = new VideoDriver({ browser, realm, version });
      localMediaTrack = await videoDriver.createLocalAudioTrack();
      waitForEvent = new Promise(resolve => localMediaTrack.once(event, resolve));
      if (method === 'enable') {
        await localMediaTrack.disable();
      }
      await localMediaTrack[method]();
    });

    it(`should set .${prop} to ${expected}`, () => {
      assert.equal(localMediaTrack[prop], expected);
    });

    it(`should emit "${event}" on the LocalMediaTrack`, () => {
      return waitForEvent;
    });

    after(() => {
      if (videoDriver) {
        videoDriver.close();
      }
    });
  });

  describe('"started" event', async () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let localMediaTrack: LocalMediaTrackDriver;
        let videoDriver: VideoDriver;
        let waitForEvent: Promise<void>;

        before(async () => {
          videoDriver = new VideoDriver({ browser, realm, version });
          localMediaTrack = await videoDriver.createLocalAudioTrack();
          waitForEvent = new Promise(resolve => localMediaTrack.once('started', resolve));
        });

        it('should emit the "started" event', () => {
          return waitForEvent;
        });

        it('should set .isStarted to true', () => {
          assert.equal(localMediaTrack.isStarted, true);
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
