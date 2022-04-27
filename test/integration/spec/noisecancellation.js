/* eslint-disable no-console */
'use strict';

const assert = require('assert');

const { createLocalAudioTrack } = require('../../../es5');

describe('noise cancellation', () => {
  [
    {
      name: 'when noise cancellation library is not hosted normal audio track is created',
      noiseCancellationOptions: { vendor: 'krisp', sdkAssetsPath: '/not_hosted/krisp' },
      expectedVendor: null,
    },
    {
      name: 'krisp track is created with correct options',
      noiseCancellationOptions: { vendor: 'krisp', sdkAssetsPath: '/noisecancellation/krisp' },
      expectedVendor: 'krisp',
    },
    {
      name: 'rnnoise track is created with correct options',
      noiseCancellationOptions: { vendor: 'rnnoise', sdkAssetsPath: '/noisecancellation/rnnoise' },
      expectedVendor: 'rnnoise',
    },
    {
      name: 'noise cancellation is optional',
      noiseCancellationOptions: null,
      expectedVendor: null,
    }
  ].forEach(({ name, noiseCancellationOptions, expectedVendor}) => {
    it(name, async () => {
      const audioTrack = await createLocalAudioTrack({ noiseCancellationOptions });
      assert(audioTrack, `unexpected audioTrack ${audioTrack}`);
      if (expectedVendor) {
        assert(audioTrack.noiseCancellation, `unexpected audioTrack.noiseCancellation: ${audioTrack.noiseCancellation}`);
        assert.equal(audioTrack.noiseCancellation.vendor, expectedVendor, 'unexpected vendor');

        // verify that noise cancellation can be enable/disable'd.
        audioTrack.noiseCancellation.disable();
        audioTrack.noiseCancellation.enable();

      } else {
        assert.equal(audioTrack.noiseCancellation, null, `unexpected audioTrack.noiseCancellation: ${audioTrack.noiseCancellation}`);
      }
    });
  });
});
