'use strict';

var assert = require('assert');
var ECS = require('../../../lib/ecs');
var request = require('../../../lib/request');
var sinon = require('sinon');
var twilio = require('twilio');

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
    });
  });
});
