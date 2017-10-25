'use strict';

const assert = require('assert');
const sinon = require('sinon');
const twilio = require('twilio');

const ECS = require('../../../lib/ecs');
const request = require('../../../lib/request');
const TwilioError = require('../../../lib/util/twilioerror');

const {
  AccessTokenInvalidError,
  ConfigurationAcquireFailedError
} = require('../../../lib/util/twilio-video-errors');

const fakeToken = 'a.b.c';

describe('ECS', () => {
  describe('#getConfiguration', () => {
    let requestPost;

    beforeEach(() => {
      requestPost = request.post;
      request.post = new sinon.spy(async params => '{"foo":"bar","a":123}');
    });

    afterEach(() => {
      request.post = requestPost;
    });

    context('when passed no token', () => {
      it('should throw an exception', () => {
        assert.throws(() => ECS.getConfiguration());
      });
    });

    context('when passed a token', () => {
      it('should make a network request with the passed body', () => {
        ECS.getConfiguration(fakeToken, {
          body: { a: 'foo', b: 'bar' }
        });
        assert.equal(request.post.args[0][0].body, 'a=foo&b=bar');
      });

      it('should make a network request with an empty body if no params are passed', () => {
        ECS.getConfiguration(fakeToken);
        assert.equal(request.post.args[0][0].body, undefined);
      });

      it('should use the passed token in the network request headers', () => {
        ECS.getConfiguration(fakeToken);
        assert.equal(request.post.args[0][0].headers['X-Twilio-Token'], fakeToken);
      });

      it('should use a custom configUrl if specified', () => {
        ECS.getConfiguration(fakeToken, { configUrl: 'http://foo.com' });
        assert.deepEqual(request.post.args[0][0].url, 'http://foo.com');
      });

      it('should return the fetched payload as a valid JSON object', async () => {
        const config = await ECS.getConfiguration(fakeToken);
        assert.deepEqual(config, { foo: 'bar', a: 123 });
      });

      it('should throw a ConfigurationAcquireFailedError if the fetched payload is not valid JSON', () => {
        request.post = async () => '{"foo": 123, "bar" "xyz"}';
        testGetConfigurationError(ConfigurationAcquireFailedError, 53500, 'Unable to acquire configuration');
      });

      context('when request() rejects the returned promise with an error code and message', () => {
        it('should throw the appropriate TwilioError if present', () => {
          request.post = async () => { throw '{"code": 20101, "message": "Invalid Access Token"}'; };
          return testGetConfigurationError(AccessTokenInvalidError, 20101, 'Invalid Access Token');
        });

        it('should throw a generic TwilioError if there is no constructor for the given error code', () => {
          request.post = async () => { throw '{"code": 12345, "message": "Generic error"}'; };
          return testGetConfigurationError(TwilioError, 12345, 'Generic error');
        });
      });

      context('when request() rejects the returned promise without an error code or message', () => {
        it('should throw a generic TwilioError with error code 0 and message "Unknown error"', () => {
          request.post = async () => { throw '{"abc": 123, "def": "xyz"}' };
          return testGetConfigurationError(TwilioError, 0, 'Unknown error');
        });
      });

      context('when request() rejects the returned promise invalid JSON', () => {
        it('should throw a ConfigurationAcquireFailedError', () => {
          request.post = async () => { throw '{"code": 123, "message" "xyz"}'; };
          return testGetConfigurationError(ConfigurationAcquireFailedError, 53500, 'Unable to acquire configuration');
        });
      });
    });
  });
});

async function testGetConfigurationError(klass, code, message) {
  try {
    await ECS.getConfiguration(fakeToken);
  } catch (error) {
    assert(error instanceof klass);
    assert.equal(error.code, code);
    if (message) {
      assert.equal(error.message, message);
    }
    return;
  }
  throw new Error('Unexpected resolution');
}
