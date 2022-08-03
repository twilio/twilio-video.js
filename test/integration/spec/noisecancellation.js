'use strict';

const assert = require('assert');

const { Logger, createLocalAudioTrack, connect } = require('../../../es5');
const defaults = require('../../lib/defaults');
const { createRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const {
  randomName,
  waitFor,
  waitForSometime,
} = require('../../lib/util');

describe('createLocalAudioTrack', () => {
  [
    {
      testName: 'when noise cancellation library is not hosted returns regular audio track',
      noiseCancellationOptions: { vendor: 'rnnoise', sdkAssetsPath: '/not_hosted/rnnoise' },
      expectedVendor: null
    },
    {
      testName: 'returns rnnoise track when vendor = rnnoise ',
      noiseCancellationOptions: { vendor: 'rnnoise', sdkAssetsPath: '/noisecancellation/rnnoise' },
      expectedVendor: 'rnnoise'
    },
    {
      testName: 'noise cancellation is optional',
      noiseCancellationOptions: null,
      expectedVendor: null
    }
  ].forEach(({ testName, noiseCancellationOptions, expectedVendor }) => {
    let audioTrack = null;
    before(async () => {
      audioTrack = await createLocalAudioTrack({ noiseCancellationOptions });
    });

    it(testName, async function()  {
      assert(audioTrack, `unexpected audioTrack ${audioTrack}`);
      if (expectedVendor) {
        assert(audioTrack.noiseCancellation, `unexpected audioTrack.noiseCancellation: ${audioTrack.noiseCancellation}`);
        assert.equal(audioTrack.noiseCancellation.vendor, expectedVendor, 'unexpected vendor');

        // ensure that source track is accessible.
        assert(audioTrack.noiseCancellation.sourceTrack.getSettings());

        // verify that noise cancellation can be enable/disable'd.
        await audioTrack.noiseCancellation.disable();
        assert.equal(audioTrack.noiseCancellation.isEnabled, false, `unexpected audioTrack.noiseCancellation.isEnabled:${audioTrack.noiseCancellation.isEnabled}`);

        await audioTrack.noiseCancellation.enable();
        assert.equal(audioTrack.noiseCancellation.isEnabled, true, `unexpected audioTrack.noiseCancellation.isEnabled:${audioTrack.noiseCancellation.isEnabled}`);

      } else {
        assert.equal(audioTrack.noiseCancellation, null, `unexpected audioTrack.noiseCancellation: ${audioTrack.noiseCancellation}`);
      }
    });

    [true, false].forEach(noiseCancellationEnabled => {
      it(`audioTrack.noiseCancellation.isEnabled=${noiseCancellationEnabled} is maintained after restart`, async () => {
        let stoppedCount = 0;
        audioTrack.on('stopped', () => stoppedCount++);

        if (expectedVendor) {
          if (noiseCancellationEnabled) {
            await audioTrack.noiseCancellation.enable();
          } else {
            await audioTrack.noiseCancellation.disable();
          }
        }

        await audioTrack.restart();

        assert(stoppedCount === 1, `unexpected stoppedCount=${stoppedCount}`);
        if (expectedVendor) {
          assert(audioTrack.noiseCancellation.isEnabled === noiseCancellationEnabled, `Unexpected audioTrack.noiseCancellation.isEnabled: ${audioTrack.noiseCancellation.isEnabled}`);
        }
      });
    });

    it('noiseCancellation.sourceTrack.srcTrack is stopped when LocalAudioTrack is stopped', () => {
      let stoppedCount = 0;
      audioTrack.on('stopped', () => stoppedCount++);
      audioTrack.stop();
      if (expectedVendor) {
        assert(audioTrack.noiseCancellation.sourceTrack.readyState === 'ended', `unexpected readyState: ${audioTrack.noiseCancellation.sourceTrack.readyState}`);
      }
      assert(stoppedCount === 1, `unexpected stoppedCount=${stoppedCount}`);
    });
  });
});


describe(`in ${defaults.topology} room`, function()  {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);

  let audioTrack;
  let roomSid;
  const noiseCancellationAllowed = defaults.topology !== 'peer-to-peer';
  [true, false].forEach(trackPublishedDuringConnect => {
    describe(`when tracks published ${trackPublishedDuringConnect ? 'during' : 'after'} connect`, () => {
      before(async () => {
        audioTrack = await createLocalAudioTrack({ noiseCancellationOptions: { vendor: 'rnnoise', sdkAssetsPath: '/noisecancellation/rnnoise' } });
        assert(audioTrack, `unexpected audioTrack ${audioTrack}`);
        roomSid = await createRoom(randomName(), defaults.topology);

        assert.strictEqual(audioTrack.noiseCancellation.isEnabled, true, 'audioTrack.noiseCancellation is not enabled');
        const aliceRoom = await connect(getToken('Alice'), {
          ...defaults,
          tracks: trackPublishedDuringConnect ? [audioTrack] : [],
          name: roomSid,
          loggerName: 'AliceLogger',
        });
        Logger.getLogger('AliceLogger').setLevel('WARN');

        if (!trackPublishedDuringConnect) {
          await waitFor(aliceRoom.localParticipant.publishTrack(audioTrack), `alice to publish track again in ${roomSid}`);
        }
      });

      it(`noise cancellation ${noiseCancellationAllowed ? 'stays enabled' : 'gets disabled'}`, async () => {
        await waitForSometime(1000);
        assert.strictEqual(audioTrack.noiseCancellation.isEnabled, noiseCancellationAllowed, `audioTrack.noiseCancellation.isEnabled = ${audioTrack.noiseCancellation.isEnabled}`);
      });

      it(`subsequent attempts to enable/disable track: ${noiseCancellationAllowed ? 'succeed' : 'fail'}`, async () => {
        let exceptionMessage = null;
        try {
          await audioTrack.noiseCancellation.enable();
          await audioTrack.noiseCancellation.disable();
          await audioTrack.noiseCancellation.enable();
        } catch (ex) {
          exceptionMessage = ex.message;
        }
        assert.strictEqual(exceptionMessage, noiseCancellationAllowed ? null : `${audioTrack.noiseCancellation.vendor} noise cancellation is disabled permanently for this track`, `exceptionMessage = ${exceptionMessage}`);
        assert.strictEqual(audioTrack.noiseCancellation.isEnabled, noiseCancellationAllowed, `audioTrack.noiseCancellation.isEnabled = ${audioTrack.noiseCancellation.isEnabled}`);
      });
    });
  });
});
