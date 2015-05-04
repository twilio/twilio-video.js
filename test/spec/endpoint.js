'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var config = require('../../test');
var accountSid = config['accountSid'];
var authToken = config['authToken'];
var wsServer = config['wsServer'];
var getCapabilityToken =
  require('../token').getCapabilityToken.bind(null, accountSid, authToken);

describe('Endpoint (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getCapabilityToken(aliceName);
  var alice = null;

  var options = {
    debug: false,
    wsServer: wsServer,
    logLevel: 'off'
  };

  var createEndpoint = function(options) {
    return new Endpoint(aliceToken, options);
  };

  describe('constructor', function() {
    it('should return an instance of Endpoint', function() {
      alice = new Endpoint(aliceToken, options);
      assert(alice instanceof Endpoint);
    });

    it('should validate logLevel', function() {
      assert.throws(createEndpoint.bind(this, { logLevel: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate ICE servers', function() {
      assert.throws(createEndpoint.bind(this, { iceServers: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate token', function() {
      assert.throws(function() {
        new Endpoint('abc');
      }, /INVALID_TOKEN/);
    });
  });

  describe('#listen', function() {
    it('should return a promise', function(done) {
      alice.listen().then(
        function() { done(); }, 
        function() { done(); }
      );
    });

    it('should set .isListening', function() {
      assert(alice.isListening);
    });

    it('should set .address', function() {
      assert.equal(aliceName, alice.address);
    });
  });

  describe('#unlisten', function() {
    before(function(done) {
      alice.unlisten().then(
        function() { done(); },
        function() { done(); }
      );
    });

    it('updates .isListening', function() {
      assert(!alice.listening);
    });

    it('does not update .address', function() {
      assert.equal(aliceName, alice.address);
    });
  });

  describe('#listen (with new Token)', function() {
    var aliceName = null;
    var aliceToken = null;

    before(function(done) {
      aliceName = randomName();
      aliceToken = getCapabilityToken(aliceName);
      alice.listen(aliceToken).then(function() {
        done();
      }, done);
    });

    it('updates .listening', function() {
      assert(alice.isListening);
    });

    it('updates .address', function() {
      assert.equal(aliceName, alice.address);
    });
  });

  var uaName = null;
  var uaToken = null;
  var ua = null;

  describe('Receive incoming call', function() {
    var ict = null;
    var invite = null;

    it('emits "invite"', function(done) {
      uaName = randomName();
      uaToken = getCapabilityToken(uaName);
      ua = new SIPJSUserAgent(uaToken, options);
      ua.register().then(function() {
        ict = ua.invite(alice.address);
      }, function(error) {
        done(error);
      });
      alice.once('invite', function(_invite) {
        invite = _invite;
        done();
      });
    });

    it.skip('invite.conversationSid', function() {
      assert(invite.conversationSid);
    });

    describe('Invite#accept', function() {
      var conversation = null;

      it('updates .conversations', function(done) {
        invite.accept().then(function(_conversation) {
          conversation = _conversation;
          assert(alice.conversations.has(conversation));
        }).then(done, done);
      });

      describe('Conversation#leave', function() {
        it('updates .conversations', function(done) {
          conversation.leave().then(function() {
            assert(!alice.conversations.has(conversation));
          }).then(done, done);
        });
      });
    });
  });

  describe('#createConversation', function() {
    var conversation = null;

    var createConversation = function(name, options) {
      return alice.createConversation(name, options);
    };

    it('should validate an address was passed', function() {
      assert.throws(createConversation.bind(this), /INVALID_ARGUMENT/);
    });

    it('should validate localStream', function() {
      assert.throws(createConversation.bind(this, uaName, { localStream: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate localStreamConstraints', function() {
      assert.throws(createConversation.bind(this, uaName, { localStreamConstraints: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should update .conversations', function(done) {
      alice.createConversation(uaName).then(function(_conversation) {
        conversation = _conversation;
        assert(alice.conversations.has(conversation));
      }).then(done, done);
      ua.once('invite', function(ist) {
        ist.accept();
      });
    });

    it('should be cancelable', function(done) {
      var canceled = false;

      var invite = alice.createConversation(uaName);
      invite.then(function() {
        assert.fail('cancel was not fired');
      }, function(reason) {
        assert(reason.message === 'canceled');
      }).then(done, done);

      invite.cancel();
    });

    describe('Conversation#leave', function() {
      it('updates .conversations', function(done) {
        conversation.leave().then(function() {
          assert(!alice.conversations.has(conversation));
        }).then(done, done);
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
