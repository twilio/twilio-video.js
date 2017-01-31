'use strict';

const assert = require('assert');
const AccessTokenInvalidError = require('../../../lib/util/twilio-video-errors').AccessTokenInvalidError;
const Client = require('../../../lib/client');
const sinon = require('sinon');
const initialToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmLTE0NzUxOTAzNDgiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJhc2QiLCJydGMiOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTM2Y3NWUwZjE0ZTdjOGIyMDkzOGZjNTA5MmU4MmYyM2EifX0sImlhdCI6MTQ3NTE5MDM0OCwiZXhwIjoxNDc1MTkzOTQ4LCJpc3MiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmIiwic3ViIjoiQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5MyJ9.N0UuZSblqb7MknNuiRkiEVVEdmztm5AdYIhQp7zU2PI';
const newToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTS2NiN2FhY2EyZmU3MDY4MjY0ZGM1OTUzMjliZDk3MzFhLTE0ODExMzMxOTAiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJqMXFtcmV2aDdmbmZxdGJhMHhoemQ3dmkiLCJydGMiOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTNmQzNmI4YzJlMjQ2N2QyZDM4NTg5YTU3ZjFkMTliM2UifX0sImlhdCI6MTQ4MTEzMzE5MCwiZXhwIjoxNDgxMTM2NzkwLCJpc3MiOiJTS2NiN2FhY2EyZmU3MDY4MjY0ZGM1OTUzMjliZDk3MzFhIiwic3ViIjoiQUM2MmMyMmMyNjIzMmFjNWVhMDNjZGQwNzVmYmQxNWY3MiJ9.qgtgWqyzxTCKO7Y_8ejtd_OaJtSctlaetA2h3kKxfEU';


describe('Client', () => {
  describe('constructor', () => {
    it('should throw if the initialToken is invalid', () => {
      assert.throws(() => new Client('foo'), error => {
        return error instanceof AccessTokenInvalidError
          && error.code === 20101;
      });
    });

    it('calls ECS.getConfiguration with the initialToken (and ecsOptions)', () => {
      const ecsResponse = {
        video: {
          network_traversal_service: {
            ttl: 0
          }
        }
      };

      const getConfiguration = sinon.spy(() => Promise.resolve(ecsResponse));

      const client = new Client(initialToken, {
        ECS: {
          getConfiguration: getConfiguration
        }
      });

      assert.equal(getConfiguration.args[0][0], initialToken);
    });
  });

  describe('#connect', () => {
    describe('called without LocalMedia', () => {
      it('acquires LocalMedia', () => {
        const getLocalMedia = sinon.spy();
        const client = new Client(initialToken, {
          getLocalMedia: getLocalMedia
        });
        client.connect();
        assert(getLocalMedia.calledOnce);
      });

      describe('and then immediately canceled by calling .cancel()', () => {
        it('calls .stop() on the LocalMedia', () => {
          const localMedia = {
            stop: sinon.spy()
          };
          const getLocalMedia = () => Promise.resolve(localMedia);
          const client = new Client(initialToken, {
            getLocalMedia: getLocalMedia
          });
          const promise = client.connect();
          promise.cancel();
          return promise.then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(localMedia.stop.calledOnce);
          });
        });
      });
    });
  });

  describe('#updateToken', () => {
    it('should throw if the newToken is invalid', () => {
      const client = new Client(initialToken);
      assert.throws(() => client.updateToken('foo'), error => {
        return error instanceof AccessTokenInvalidError
          && error.code === 20101;
      });
    });

    it('subsequent calls to ECS.getConfiguration use the newToken', done => {
      const ecsResponse = {
        video: {
          network_traversal_service: {
            ttl: 0
          }
        }
      };

      const getConfiguration = sinon.spy(() => Promise.resolve(ecsResponse));

      const client = new Client(initialToken, {
        ECS: {
          getConfiguration: getConfiguration
        }
      });

      client.updateToken(newToken);

      setTimeout(() => {
        try {
          assert.equal(getConfiguration.args[1][0], newToken);
        } catch (error) {
          done();
        }
      });
    });
  });
});
