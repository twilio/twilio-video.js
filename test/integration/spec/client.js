'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');

var Client = require('lib/client');
var SIPJSUserAgent = require('lib/signaling/sipjsuseragent');
var util = require('lib/util');

var credentials = require('../../../test.json');
var getToken = require('test/lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

var useConversationEvents = process.env.USE_CONVERSATION_EVENTS;

describe('Client (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var alice = null;

  var options = {
    debug: false,
    wsServer: wsServer,
    logLevel: 'off',
    useConversationEvents: useConversationEvents
  };

  var createClient = function(token, options) {
    return new Client(token, options);
  };

  describe('constructor', function() {
    it('should return an instance of Client', function() {
      alice = new Client(aliceToken, options);
      assert(alice instanceof Client);
    });

    it('should validate logLevel', function() {
      assert.throws(createClient.bind(this, aliceToken, { logLevel: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate ICE servers', function() {
      assert.throws(createClient.bind(this, aliceToken, { iceServers: 'foo' }), /INVALID_ARGUMENT/);
    });

    it('should validate token', function() {
      assert.throws(function() {
        new Client('abc');
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

    it('should register', function() {
      assert(alice._isRegistered);
    });

    it('should set .address', function() {
      assert.equal(aliceName, alice.address);
    });

    it('should emit tokenExpired when active token expires', function(done) {
      var jwt = getToken({ address: aliceName, duration: 500 });
      alice.listen(jwt);
      alice.once('error', function(error) {
        var nameRegex = /TOKEN_EXPIRED/i;
        assert(nameRegex.test(error.name));
        done();
      });
    });

    it('should not emit tokenExpired when an inactive token expires', function(done) {
      var jwt1 = getToken({ address: aliceName, duration: 1000 });
      var jwt2 = getToken({ address: aliceName });
      var hasFired = false;

      alice.listen(jwt1).then(function() {
        return alice.listen(jwt2);
      }, done);

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
      assert(!alice.isListening);
    });

    it('should not need to be registered', function() {
      assert(!alice._needsRegistration);
    });

    it('should unregister', function() {
      assert(!alice.isRegistered);
    });

    it('does not update .address', function() {
      assert.equal(aliceName, alice.address);
    });
  });

  describe('#unlisten (but still registered)', function() {
    var uaName = null;
    var uaToken = null;
    var ua = null;

    it('should not emit "invite" events', function setupUA(done) {
      this.timeout(6000);
      uaName = randomName();
      uaToken = getToken({ address: uaName });
      ua = new SIPJSUserAgent(uaToken, options);
      ua.invite(aliceName).then(function() {
        alice.removeListener('invite', receivedInvite);
        done(new Error('InviteClientTransaction succeeded'));
      }, function(error) {
        alice.removeListener('invite', receivedInvite);
        done();
      });
      function receivedInvite() {
        done(new Error('Emitted "invite" event'));
      }
      alice.once('invite', receivedInvite);
    });
  });

  // FIXME(mroberts): We have a regression with the new
  // AccessToken; refer to the comment in Client#listen for
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

    it('updates .isListening', function() {
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

  var conversation = null;
  var conversation2 = null;

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
      uaToken = getToken({ address: uaName });
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

    describe('#unlisten (with pending Invite)', function() {
      before(function unlisten(done) {
        alice.unlisten().then(function() {
          done();
        }, done);
      });

      it('should update .isListening', function() {
        assert(!alice.isListening);
      });

      it('should still need to be registered', function() {
        assert(alice._needsRegistration);
      });
    });

    describe('Invite#accept', function() {
      it('updates .conversations', function(done) {
        invite.accept().then(function(_conversation) {
          conversation = _conversation;
          assert(alice.conversations.has(conversation));
        }).then(done, done);
      });

      describe('Conversation#disconnect', function() {
        it('updates .conversations', function(done) {
          conversation.disconnect().then(function() {
            assert(!alice.conversations.has(conversation));
          }).then(done, done);
        });

        it('should not need to be registered', function() {
          assert(!alice._needsRegistration);
        });

        it('should unregister', function(done) {
          alice._userAgent.once('unregistered', function() {
            done();
          });
        });
      });

      describe('Remote party hangs up', function() {
        before(function(done) {
          alice.listen().then(function() {
            return ua.invite(aliceName).then(null, done);
          }).catch(done);
          alice.once('invite', function(invite) {
            invite.accept().then(function(_conversation) {
              conversation = _conversation;
              assert(alice.conversations.has(conversation));
            }).then(function() {
              conversation.disconnect();
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
      ua2Token = getToken({ address: ua2Name });
      ua2 = new SIPJSUserAgent(ua2Token, options);

      ua2.register().then(function() {
        invite = alice.createConversation([uaName, ua2Name]);
        invite.cancel();
        assert.equal(alice._canceledConversations.size, 1);
      }).then(done, done);
    });

    it('should not reject if primary invitee declines in a multi-invite', function(done) {
      this.timeout(5000);

      ua2Name = randomName();
      ua2Token = getToken({ address: ua2Name });
      ua2 = new SIPJSUserAgent(ua2Token, options);

      var ua3Name = randomName();
      var ua3Token = getToken({ address: ua3Name });
      var ua3 = new SIPJSUserAgent(ua3Token, options);

      var ua2Invite, ua3Invite;

      function rejectThenAccept(invite1, invite2) {
        alice._userAgent.inviteClientTransactions.forEach(function(ict) {
          ict.session.once('rejected', function() {
            invite2.accept();
          });
        });

        invite1.reject();
      }

      ua2.on('invite', function(invite) {
        ua2Invite = invite;
        if (ua2Invite && ua3Invite) {
          rejectThenAccept(ua2Invite, ua3Invite);
        }
      });

      ua3.on('invite', function(invite) {
        if (util.getUser(invite.from) !== aliceName) {
          return;
        }

        ua3Invite = invite;
        if (ua2Invite && ua3Invite) {
          rejectThenAccept(ua2Invite, ua3Invite);
        }
      });

      Q.all([ua2.register(), ua3.register()]).then(function() {
        alice.createConversation([ua2Name, ua3Name])
          .then(function(conversation) {
            conversation2 = conversation;
            done();
          }, function() {
            assert.fail('Promise was rejected');
          }).catch(done);
      });
    });

    after(function cleanupPending(done) {
      alice._userAgent.inviteClientTransactions.forEach(function(ict) {
        alice._userAgent.inviteClientTransactions.delete(ict);
        alice._pendingConversations.delete(ict._cookie);
      });

      conversation2.disconnect().then(function() {
        assert(!alice.conversations.has(conversation2));
      }).then(done, done);
    });
  });

  describe('#unlisten (while in a Conversation)', function() {
    before(function unlisten(done) {
      alice.unlisten().then(function() {
        done();
      }, done);
    });

    it('should update .isListening', function() {
      assert(!alice.isListening);
    });

    it('should still need to be registered', function() {
      assert(alice._needsRegistration);
    });
  });

  describe('Conversation#disconnect', function() {
    it('updates .conversations', function(done) {
      conversation.disconnect().then(function() {
        assert(!alice.conversations.has(conversation));
      }).then(done, done);
    });

    it('should not need to be registered', function() {
      assert(!alice._needsRegistration);
    });

    it('should unregister', function(done) {
      alice._userAgent.once('unregistered', function() {
        done();
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
