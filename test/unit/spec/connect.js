'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const sinon = require('sinon');
const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmLTE0NzUxOTAzNDgiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJhc2QiLCJydGMiOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTM2Y3NWUwZjE0ZTdjOGIyMDkzOGZjNTA5MmU4MmYyM2EifX0sImlhdCI6MTQ3NTE5MDM0OCwiZXhwIjoxNDc1MTkzOTQ4LCJpc3MiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmIiwic3ViIjoiQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5MyJ9.N0UuZSblqb7MknNuiRkiEVVEdmztm5AdYIhQp7zU2PI';
const AccessTokenInvalidError = require('../../../lib/util/twilio-video-errors').AccessTokenInvalidError;

describe('connect', () => {
  describe('called without LocalMedia', () => {
    it('acquires LocalMedia', () => {
      const getLocalMedia = sinon.spy();
      connect({ token: token, getLocalMedia: getLocalMedia });
      assert(getLocalMedia.calledOnce);
    });

    describe('and then immediately canceled by calling .cancel()', () => {
      it('calls .stop() on the LocalMedia', () => {
        const localMedia = { stop: sinon.spy() };
        const getLocalMedia = () => Promise.resolve(localMedia);
        const promise = connect({ token: token, getLocalMedia: getLocalMedia });
        promise.cancel();
        return promise.then(() => {
          throw new Error('Unexpected resolution');
        }, () => {
          assert(localMedia.stop.calledOnce);
        });
      });
    });
  });

  it('should reject if the token is invalid', () => {
    return new Promise((resolve, reject) => {
      connect({ token: 'foo' }).then(reject, error => {
        try {
          assert(error instanceof AccessTokenInvalidError);
          assert.equal(error.code, 20101);
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });
});
