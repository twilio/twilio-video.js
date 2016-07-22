'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var Client = require('../../../lib/client');
var LocalMedia = require('../../../lib/media/localmedia');
var SignalingV2 = require('../../../lib/signaling/v2');
var util = require('../../../lib/util');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Client', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var alice = null;

  var options = {
    debug: false,
    logLevel: 'off'
  };

  if (wsServer) {
    options.wsServer = wsServer;
  }

  var createClient = function(token, options) {
    var accessManager = new AccessManager(token);
    return new Client(accessManager, options);
  };

  var localMedia = new LocalMedia();

  describe('constructor', function() {
    it('should return an instance of Client', function() {
      alice = new Client(aliceToken, options);
      assert(alice instanceof Client);
    });

    it('should validate token is a string', function() {
      assert.throws(createClient.bind(this, { foo: 'bar' }), /INVALID_ARGUMENT/);
    });

    it('should validate logLevel', function() {
      assert.throws(createClient.bind(this, aliceToken, { logLevel: 'foo' }), /INVALID_ARGUMENT/);
    });
  });

  var room = null;

  describe('#connect', function() {

    it('should update .rooms', function(done) {
      alice.connect().then(function(_room) {
        room = _room;
        assert(alice.rooms.has(room.sid));
      }).then(done, done);
    });

    it('should be cancelable', function(done) {
      var cancelablePromise = alice.connect();
      cancelablePromise.cancel().then(() => done(new Error('Unexpected resolution')), () => done());
    });
  });

  describe('Room#disconnect', function() {
    it('updates .rooms', function() {
      assert(room);
      room.disconnect();
      assert(!alice.rooms.has(room.sid));
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
