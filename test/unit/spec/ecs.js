'use strict';

var assert = require('assert');
var ECS = require('../../../lib/ecs');
var request = require('../../../lib/request');
var sinon = require('sinon');
var twilio = require('twilio');
var TwilioError = require('../../../lib/util/twilioerror');
var AccessTokenInvalidError = require('../../../lib/util/twilio-video-errors').AccessTokenInvalidError;

var fakeToken = 'a.b.c';

describe('ECS', function() {
  describe('#getConfiguration', function() {
    var requestPost = request.post;

    beforeEach(function() {
      request.post = new sinon.spy(function(params) {
        return Promise.resolve('{"foo":"bar","a":123}');
      });
    });

    afterEach(function() {
      request.post = requestPost;
    });

    context('when passed no token', function() {
      it('should throw an exception', function() {
        assert.throws(function() {
          ECS.getConfiguration();
        });
      });
    });

    context('when passed a token', function() {
      it('should make a network request with the passed body', function() {
        ECS.getConfiguration(fakeToken, {
          body: { a: 'foo', b: 'bar' }
        });
        assert.equal(request.post.args[0][0].body, 'a=foo&b=bar');
      });

      it('should make a network request with an empty body if no params are passed', function() {
        ECS.getConfiguration(fakeToken);
        assert.equal(request.post.args[0][0].body, undefined);
      });

      it('should use the passed token in the network request headers', function() {
        ECS.getConfiguration(fakeToken);
        assert.equal(request.post.args[0][0].headers['X-Twilio-Token'], fakeToken);
      });

      it('should use a custom configUrl if specified', function() {
        ECS.getConfiguration(fakeToken, { configUrl: 'http://foo.com' });
        assert.deepEqual(request.post.args[0][0].url, 'http://foo.com');
      });

      it('should return the fetched payload as a valid JSON object', function() {
        return ECS.getConfiguration(fakeToken).then(function(config) {
          assert.deepEqual(config, { foo: 'bar', a: 123 });
        });
      });

      context('when request() rejects the returned promise with an error code and message', function() {
        it('should throw the appropriate TwilioError if present', function() {
          request.post = function() {
            return Promise.reject('{"code": 20101, "message": "Invalid Access Token"}');
          };
          return testGetConfigurationError(AccessTokenInvalidError, 20101, 'Invalid Access Token');
        });

        it('should throw a generic TwilioError if there is no constructor for the given error code', function() {
          request.post = function() {
            return Promise.reject('{"code": 12345, "message": "Generic error"}');
          };
          return testGetConfigurationError(TwilioError, 12345, 'Generic error');
        });
      });

      context('when request() rejects the returned promise without an error code or message', function() {
        it('should throw a generic TwilioError with error code 0 and message "Unknown error"', function() {
          request.post = function() {
            return Promise.reject('{"abc": 123, "def": "xyz"}');
          };
          return testGetConfigurationError(TwilioError, 0, 'Unknown error');
        });
      });

      context('when request() rejects the returned promise with bad JSON response', function() {
        it('should throw a generic TwilioError with error code 0', function() {
          request.post = function() {
            return Promise.reject('{"code": 123, "message" "xyz"}');
          };
          return testGetConfigurationError(TwilioError, 0);
        });
      });
    });
  });
});

function testGetConfigurationError(klass, code, message) {
  return new Promise(function(resolve, reject) {
    ECS.getConfiguration(fakeToken).then(reject, function(error) {
      try {
        assert(error instanceof klass);
        assert.equal(error.code, code);
        if (message) {
          assert.equal(error.message, message);
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}
