'use strict';

var assert = require('assert');
var constants = require('../../../../lib/util/constants');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var util = require('../../../../lib/util');


describe('util', function() {
  describe('makeRegisterHeaders', function() {
    var sdkVersion;
    var navigator;

    before(function saveInitialState() {
      sdkVersion = process.env.SDK_VERSION;
      navigator = global.navigator;
    });

    after(function restoreInitialState() {
      process.env.SDK_VERSION = sdkVersion;
      global.navigator = navigator;
    });

    it('should use the jwt of the token passed in', function() {
      var regHeaders = util.makeRegisterHeaders('foobar');
      var tokenHeader = regHeaders[0];
      assert(/foobar$/.test(tokenHeader));
    });

    it('should use the correct system info when navigator and sdk version are set', function() {
      process.env.SDK_VERSION = 'v0.1.2.3';
      global.navigator = { userAgent: 'foo', platform: 'bar' };
      var regHeaders = util.makeRegisterHeaders('');
      var systemInfo = JSON.parse(regHeaders[1].slice(17));

      assert.equal(systemInfo.v, 'v0.1.2.3');
      assert.equal(systemInfo.browser.userAgent, 'foo');
      assert.equal(systemInfo.browser.platform, 'bar');
    });

    it('should use the correct system info when navigator and sdk version are not set', function() {
      delete process.env.SDK_VERSION;
      delete global.navigator;

      var regHeaders = util.makeRegisterHeaders('');
      var systemInfo = JSON.parse(regHeaders[1].slice(17));

      assert.equal(systemInfo.v, 'unknown');
      assert.equal(systemInfo.browser.userAgent, 'unknown');
      assert.equal(systemInfo.browser.platform, 'unknown');
    });
  });

  describe('makeSIPURI', function() {
    it('should contain the accountSid and client name passed in', function() {
      var uri = util.makeSIPURI('AC1234', 'alice');
      assert(/AC1234/.test(uri));
      assert(/alice/.test(uri));
    });
  });

  describe('makeUUID', function() {
    it('should generate a unique UUID', function() {
      var uuid1 = util.makeUUID();
      var uuid2 = util.makeUUID();
      var uuid3 = util.makeUUID();

      assert.notEqual(uuid1, uuid2);
      assert.notEqual(uuid2, uuid3);
      assert.notEqual(uuid1, uuid3);
    });
  });

  describe('promiseFromEvents', function() {
    var emitter;
    var promise;
    var spy;

    beforeEach(function() {
      emitter = new EventEmitter();
      spy = sinon.spy();
      promise = util.promiseFromEvents(spy, emitter, 'foo', 'bar');
    });

    it('should call the function passed', function() {
      assert(spy.calledOnce);
    });

    it('should resolve when the success event is fired', function(done) {
      promise.then(done);
      emitter.emit('foo');
    });

    it('should reject when the failure event is fired', function(done) {
      promise.catch(done);
      emitter.emit('bar');
    });

    it('should not require a failure event', function(done) {
      promise = util.promiseFromEvents(spy, emitter, 'foo');
      promise.then(done);
      emitter.emit('foo');
    });
  });

  describe('parseConversationSIDFromContactHeader', function() {
    var conversationSid = 'CV123';

    it('should parse contact headers with display names', function() {
      var contactHeader = '"fud" <sip:CV123@172.18.8.202:443;transport=wss>';
      assert.equal(conversationSid,
        util.parseConversationSIDFromContactHeader(contactHeader));
    });

    it('should parse contact headers without display names', function() {
      var contactHeader = '<sip:CV123@172.18.8.202:443;transport=wss>';
      assert.equal(conversationSid,
        util.parseConversationSIDFromContactHeader(contactHeader));
    });

    it('should return null if the input is not a valid contact header', function() {
      var contactHeader = 'foo-bar';
      assert.equal(util.parseConversationSIDFromContactHeader(contactHeader), null);
    });
  });

  describe('parseUserAgent', function() {
    var matchesUA = function(uaString, name, version) {
      var spec = util.parseUserAgent(uaString);
      return spec.name === name && spec.version === version;
    };

    it('should return "Unknown" if the user agent is not valid', function() {
      var spec = util.parseUserAgent('foobar browser');
      assert.equal(spec.name, 'Unknown');
      assert.equal(spec.version, 'Unknown');
    });

    it('should return "Unknown" if the user agent is not a valid IE string', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (compatible, foo, bar 1.1; Trident/1.0;)');
      assert.equal(spec.name, 'IE');
      assert.equal(spec.version, 'Unknown');
    });

    it('should return the correct object for a Chrome user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36');
      assert.equal(spec.name, 'Chrome');
      assert.equal(spec.version, '42.0');
    });

    it('should return the correct object for a Firefox user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0');
      assert.equal(spec.name, 'Firefox');
      assert.equal(spec.version, '38.0');
    });

    it('should return the correct object for a Safari user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/600.5.17 (KHTML, like Gecko) Version/8.0.5 Safari/600.5.17');
      assert.equal(spec.name, 'Safari');
      assert.equal(spec.version, '600.5');
    });

    it('should return the correct object for an Opera user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36 OPR/29.0.1795.47');
      assert.equal(spec.name, 'Opera');
      assert.equal(spec.version, '29.0');
    });

    it('should return the correct object for a newer IE user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko');
      assert.equal(spec.name, 'IE');
      assert.equal(spec.version, '11.0');
    });

    it('should return the correct object for an older IE user agent', function() {
      var spec = util.parseUserAgent('Mozilla/5.0 (compatible; MSIE 7.0; Windows NT 6.0; en-US)');
      assert.equal(spec.name, 'IE');
      assert.equal(spec.version, '7.0');
    });
  });

  describe('getOrNull', function() {
    it('should return the value at the end of the path if it exists', function() {
      var foo = { bar: { baz: 'qux' } };
      assert.equal(util.getOrNull(foo, 'bar.baz'), 'qux');
    });

    it('should return null if any link doesn\'t exist', function() {
      var foo = { bar: { baz: 'qux' } };
      assert.equal(util.getOrNull(foo, 'baz.bar.qux'), null);
    });
  });

  describe('overwriteArray', function() {
    it('should push all items of the new array into the emptied old array', function() {
      var a = ['foo', 'bar'];
      var b = ['baz', 'qux'];
      util.overwriteArray(a, b);

      assert.equal(a[0], 'baz');
      assert.equal(a[1], 'qux');
    });
  });
});
