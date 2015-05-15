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
var signingKeySid = config['signingKeySid'];
var signingKeySecret = config['signingKeySecret'];
var wsServer = config['wsServer'];
var getToken = require('../token').getToken.bind(null, accountSid,
  signingKeySid, signingKeySecret);

var Token = require('../../lib/accesstoken');

describe('Endpoint (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getToken(aliceName);
  var alice = null;

  var options = {
    debug: false,
    wsServer: wsServer,
    logLevel: 'off'
  };

  var createEndpoint = function(token, options) {
    return new Endpoint(token, options);
  };

  describe('constructor', function() {
    it('should return an instance of Endpoint', function() {
      alice = new Endpoint(aliceToken, options);
      assert(alice instanceof Endpoint);
    });

    it('should validate logLevel', function() {
      assert.throws(createEndpoint.bind(this, aliceToken, { logLevel: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate ICE servers', function() {
      assert.throws(createEndpoint.bind(this, aliceToken, { iceServers: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate token', function() {
      assert.throws(function() {
        new Endpoint('abc');
      }, /INVALID_TOKEN/);
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

    it('should set .address', function() {
      assert.equal(aliceName, alice.address);
    });

    it('should emit tokenExpired when active token expires', function(done) {
      var jwt = getToken(aliceName, 3000);
      alice.listen(jwt);
      alice.once('error', function(error) {
        var nameRegex = /TOKEN_EXPIRED/i;
        assert(nameRegex.test(error.name));
        done();
      });
    });

    it('should not emit tokenExpired when an inactive token expires', function(done) {
      var jwt1 = getToken(aliceName, 3000);
      var jwt2 = getToken(aliceName);
      var hasFired = false;

      alice.listen(jwt1).then(function() {
        return alice.listen(jwt2);
      });

      alice.once('error', function(error) {
        hasFired = true;
      });

      jwt1.once('expired', function() {
        setTimeout(function() {
          assert(!hasFired);
          done();
        }, 10);
      });
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

  // FIXME(mroberts): We have a regression with the new
  // AccessToken; refer to the comment in Endpoint#listen for
  // more information.
  /*describe('#listen (with new Token)', function() {
    var aliceName = null;
    var aliceToken = null;

    before(function(done) {
      aliceName = randomName();
      aliceToken = getToken(aliceName);
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
  });*/

  var uaName = null;
  var uaToken = null;
  var ua = null;

  var ua2Name = null;
  var ua2Token = null;
  var ua2 = null;

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
      uaName = randomName();
      uaToken = getToken(uaName);
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

    it('invite.conversationSid', function() {
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

      describe('Remote party hangs up', function() {
        var conversation = null;

        before(function(done) {
          ua.invite(aliceName).then(null, done);
          alice.on('invite', function(invite) {
            invite.accept().then(function(_conversation) {
              conversation = _conversation;
              assert(alice.conversations.has(conversation));
            }).then(function() {
              conversation.leave();
            }).then(done, done);
          });
        });

        it('updates .conversations', function() {
          assert(!alice.conversations.has(conversation));
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

    it('should auto-reject associated invites after it is canceled', function(done) {
      this.timeout(5000);
      var invite;

      ua2Name = randomName();
      ua2Token = getToken(ua2Name);
      ua2 = new SIPJSUserAgent(ua2Token, options);

      ua2.register().then(function() {
        invite = alice.createConversation([uaName, ua2Name]);
        invite.cancel();
        assert.equal(alice._canceledConversations.size, 1);
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

function randomName() {
  return Math.random().toString(36).slice(2);
}
