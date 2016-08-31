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
  var bobName = randomName();
  var bobToken = getToken({ address: bobName });
  var charlieName = randomName();
  var charlieToken = getToken({ address: charlieName });
  var alice = null;
  var bob = null;
  var charlie = null;

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
  var bobRoom = null;
  var charlieRoom = null;

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

    context('when called without options', () => {
      it('should connect bob and charlie to different rooms', (done) => {
        bob = new Client(bobToken, options);
        charlie = new Client(charlieToken, options);

        bob.connect().then((_bobRoom) => {
          bobRoom = _bobRoom;
          return charlie.connect();
        }).then((_charlieRoom) => {
          var msg = 'both rooms have the same sid';
          charlieRoom = _charlieRoom;
          assert.notEqual(charlieRoom.sid, bobRoom.sid, msg);
        }).then(done, done);
      });
    });
  });

  describe('Room#disconnect', function() {
    it('updates .rooms', function() {
      assert(room);
      room.disconnect();
      assert(!alice.rooms.has(room.sid));
    });
  });

  after(() => {
    if (bobRoom) {
      bobRoom.disconnect();
    }
    if (charlieRoom) {
      charlieRoom.disconnect();
    }
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
