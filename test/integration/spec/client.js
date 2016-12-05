'use strict';

var sinon = require('sinon');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var Client = require('../../../lib/client');
var Log = require('../../../lib/util/log');
var LocalMedia = require('../../../lib/media/localmedia');
var SignalingV2 = require('../../../lib/signaling/v2');
var util = require('../../../lib/util');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;
var logLevel = credentials.logLevel;

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
    debug: false
  };

  if (wsServer) {
    options.wsServer = wsServer;
  }
  if (logLevel) {
    options.logLevel = logLevel;
  }

  var createClient = function(token, options) {
    return new Client(token, options);
  };

  describe('constructor', function() {
    it('should return an instance of Client', function() {
      alice = new Client(aliceToken, options);
      assert(alice instanceof Client);
    });

    it('should validate token is a string', function() {
      assert.throws(createClient.bind(this, { foo: 'bar' }), error => {
        return error instanceof TypeError && error.message === 'initialToken must be a string';
      });
    });

    it('should validate logLevel', function() {
      assert.throws(createClient.bind(this, aliceToken, { logLevel: 'foo' }), error => {
        return error instanceof TypeError && /level must be one of/.test(error.message);
      });
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

  describe('#setLogLevel', () => {
    var clientOptions = Object.assign({}, options, {
      logLevel: {
        default: 'warn',
        signaling: 'debug',
        webrtc: 'debug',
        media: 'off'
      }
    });
    var clientToken = getToken({ address: 'client'});
    var client = new Client(clientToken, clientOptions);

    it('should set Log levels to the new values', () => {
      client.setLogLevel({ default: 'error' });
      assert.equal(client._log.logLevel, Log.getLevelByName('error'));
    });

    it('should set Log levels of any child Logs to the new values', () => {
      var childLog = client._log.createLog('media', 'testMedia');
      var oldChildLogLevel = childLog.logLevel;
      client.setLogLevel({ signaling: 'error', media: 'info'});
      assert.equal(oldChildLogLevel, Log.getLevelByName('off'));
      assert.equal(childLog.logLevel, Log.getLevelByName('info'));
    });

    context('when a string is passed as the new Log level', () => {
      it('should set Log levels of all module names to this level', () => {
        client.setLogLevel('error');
        assert.deepEqual(client._log._logLevels, {
          default: 'error',
          media: 'error',
          webrtc: 'error',
          signaling: 'error'
        });
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
