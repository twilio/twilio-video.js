'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var getToken = require('test/lib/token').getToken.bind(null, {
  accountSid: 'AP123',
  signingKeySid: 'FOO123',
  signingKeySecret: 'BAR123'
});

var MockDialog = require('test/mock/dialog');
var request = require('lib/util/request');
var StatsReporter = require('lib/statsreporter');
var XHR = require('test/mock/xmlhttprequest');
XHR.respondWith('POST', 'https://foo.bar/v1/Calls', {
  responseText: '',
  status: 200,
  readyState: 4
});
XHR.respondWith('POST', 'https://foo.bar/v1/Calls/undefined/Statistics', {
  responseText: '',
  status: 200,
  readyState: 4
});

describe('StatsReporter', function() {
  var dialog;
  var reporter;
  var requestOptions;
  var token;
  var xhr;

  beforeEach(function() {
    xhr = new XHR();
    token = getToken('foo');
    dialog = new MockDialog('foo', new AccessManager(token));
    reporter = new StatsReporter('foo.bar', dialog, {
      logLevel: 'warn',
      post: function(requestParams) {
        return request.post(requestParams, {
          xmlHttpRequestFactory: function() { return xhr; }
        });
      }
    });
  });

  describe('new StatsReporter(eventGateway, dialog, logLevel, requestOptions)', function() {
    it('should return an instance of StatsReporter when called as a method', function() {
      assert(StatsReporter('foo.bar', dialog) instanceof StatsReporter);
    });
  });

  describe('dialog#stats listener', function() {
    context('when it has less than 10 stats', function() {
      it('should push the stats the queue', function() {
        dialog.emit('stats', { foo: 'bar' });
        assert.equal(reporter._samples.length, 1);
        assert.equal(reporter._samples[0].foo, 'bar');
      });
    });
    context('when it has 10 or more stats', function() {
      it('should publish the stats', function(done) {
        xhr.send = function(body) {
          var samples = JSON.parse(body).samples;
          assert.equal(samples.length, 10);
          done();
        };

        for(var i = 0; i < 10; i++) {
          dialog.emit('stats', { foo: 'bar' });
        }
      });
    });
  });

  describe('dialog#end listener', function() {
    context('when there are stats in the queue', function() {
      it('should publish any stats in the queue', function(done) {
        xhr.send = function(body) {
          var samples = JSON.parse(body).samples;
          assert.equal(samples.length, 3);
          done();
        };

        for(var i = 0; i < 3; i++) {
          dialog.emit('stats', { foo: 'bar' });
        }

        dialog.ended = true;
        dialog.emit('ended', dialog);
      });
    });

    context('when there are no stats in the queue', function() {
      it('should not attempt to publish stats', function(done) {
        var published = false;
        xhr.send = function(body) {
          published = true;
        };

        dialog.emit('ended', dialog);

        setTimeout(function() {
          assert(!published);
          done();
        }, 10);
      });
    });
  });
});
