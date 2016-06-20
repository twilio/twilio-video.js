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
  var aliceManager = new AccessManager(aliceToken);
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
      alice = new Client(aliceManager, options);
      assert(alice instanceof Client);
    });

    it('should validate logLevel', function() {
      assert.throws(createClient.bind(this, aliceManager, { logLevel: 'foo' }), /INVALID_ARGUMENT/);
    });
  });

  describe('#listen', function() {
    this.timeout(10000);
    it('should return a promise', function(done) {
      alice.listen().then(
        function() { done(); },
        function() { done(); }
      );
    });

    it('should set .isListening', function() {
      assert(alice.isListening);
    });

    it('should set .identity', function() {
      assert.equal(aliceName, alice.identity);
    });
  });

  describe('#unlisten', function() {
    before(function() {
      alice.unlisten();
    });

    it('updates .isListening', function() {
      assert(!alice.isListening);
    });

    it('does not update .identity', function() {
      assert.equal(aliceName, alice.identity);
    });
  });

  var s1Name = null;
  var s1Token = null;
  var s1Manager = null;
  var s1 = null;

  var s2Name = null;
  var s2Token = null;
  var s2Manager = null;
  var s2 = null;

  var room = null;
  var room2 = null;

  describe('Receive incoming call', function() {
    before(function(done) {
      alice.listen().then(function() {
        done();
      }, done);
    });

    var ict = null;
    var invite = null;

    it('emits "invite"', function(done) {
      this.timeout(10000);
      s1Name = randomName();
      s1Token = getToken({ address: s1Name });
      s1Manager = new AccessManager(s1Token);
      s1 = new SignalingV2(s1Manager, options);
      s1.listen().then(function() {
        ict = s1.connect(alice.identity, null, localMedia);
      }, function(error) {
        done(error);
      });
      alice.once('invite', function(_invite) {
        invite = _invite;
        done();
      });
    });

    it('invite.roomSid', function() {
      assert(invite.roomSid);
    });

    describe('#unlisten (with pending Invite)', function() {
      before(function unlisten() {
        alice.unlisten();
      });

      it('should update .isListening', function() {
        assert(!alice.isListening);
      });
    });

    describe('Invite#accept', function() {
      it('updates .rooms', function(done) {
        invite.accept(localMedia).then(function(_room) {
          room = _room;
          assert(alice.rooms.has(room.sid));
        }).then(done, done);
      });

      describe('Room#disconnect', function() {
        it('updates .rooms', function() {
          room.disconnect();
          assert(!alice.rooms.has(room.sid));
        });
      });

      describe('Remote party hangs up', function() {
        before(function(done) {
          alice.listen().then(function() {
            return s1.connect(aliceName, null, localMedia).then(null, done);
          }).catch(done);
          alice.once('invite', function(invite) {
            invite.accept(localMedia).then(function(_room) {
              room = _room;
              assert(alice.rooms.has(room.sid));
            }).then(function() {
              room.disconnect();
            }).then(done, done);
          });
        });

        it('updates .rooms', function() {
          assert(!alice.rooms.has(room.sid));
        });
      });
    });
  });

  describe('#connect', function() {

    var connect = function(name, options) {
      return alice.connect(Object.assign({
        with: name
      }, options));
    };

    it('should update .rooms', function(done) {
      alice.connect({ with: s1Name }).then(function(_room) {
        room = _room;
        assert(alice.rooms.has(room.sid));
      }).then(done, done);
      s1.once('invite', function(ist) {
        ist.accept(localMedia);
      });
    });

    it('should be cancelable', function() {
      var outgoingInvite = alice.connect({ with: s1Name });
      outgoingInvite.cancel();
      assert.equal('canceled', outgoingInvite.status);
    });

    after(function cleanupPending() {
      if (room2) {
        room2.disconnect();
        assert(!alice.rooms.has(room2.sid));
      }
    });
  });

  describe('#unlisten (while in a Room)', function() {
    before(function unlisten() {
      alice.unlisten();
    });

    it('should update .isListening', function() {
      assert(!alice.isListening);
    });
  });

  describe('Room#disconnect', function() {
    it('updates .rooms', function() {
      room.disconnect();
      assert(!alice.rooms.has(room.sid));
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
