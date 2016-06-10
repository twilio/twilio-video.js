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

  describe('parseRoomSIDFromContactHeader', function() {
    var roomSid = 'CV123';

    it('should parse contact headers with display names', function() {
      var contactHeader = '"fud" <sip:CV123@172.18.8.202:443;transport=wss>';
      assert.equal(roomSid,
        util.parseRoomSIDFromContactHeader(contactHeader));
    });

    it('should parse contact headers without display names', function() {
      var contactHeader = '<sip:CV123@172.18.8.202:443;transport=wss>';
      assert.equal(roomSid,
        util.parseRoomSIDFromContactHeader(contactHeader));
    });

    it('should return null if the input is not a valid contact header', function() {
      var contactHeader = 'foo-bar';
      assert.equal(util.parseRoomSIDFromContactHeader(contactHeader), null);
    });
  });
});
