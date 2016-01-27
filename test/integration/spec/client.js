'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var Client = require('../../../lib/client');
var SIPJSUserAgent = require('../../../lib/signaling/sipjsuseragent');
var util = require('../../../lib/util');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Client (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var aliceManager = new AccessManager(aliceToken);
  var alice = null;

  var options = {
    debug: false,
    wsServer: wsServer,
    logLevel: 'off'
  };

  var createClient = function(token, options) {
    var accessManager = new AccessManager(token);
    return new Client(accessManager, options);
  };

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

    it('should register', function() {
      assert(alice._isRegistered);
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

    it('should not need to be registered', function() {
      assert(!alice._needsRegistration);
    });

    it('should unregister', function() {
      assert(!alice.isRegistered);
    });

    it('does not update .identity', function() {
      assert.equal(aliceName, alice.identity);
    });
  });

  describe('#unlisten (but still registered)', function() {
    var uaName = null;
    var uaToken = null;
    var uaManager = null;
    var ua = null;

    it('should not emit "invite" events', function setupUA(done) {
      this.timeout(6000);
      uaName = randomName();
      uaToken = getToken({ address: uaName });
      uaManager = new AccessManager(uaToken);
      ua = new SIPJSUserAgent(uaManager, options);
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

    it('updates .identity', function() {
      assert.equal(aliceName, alice.identity);
    });
  });*/

  var uaName = null;
  var uaToken = null;
  var uaManager = null;
  var ua = null;

  var ua2Name = null;
  var ua2Token = null;
  var ua2Manager = null;
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
      uaManager = new AccessManager(uaToken);
      ua = new SIPJSUserAgent(uaManager, options);
      ua.register().then(function() {
        ict = ua.invite(alice.identity);
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
      before(function unlisten() {
        alice.unlisten();
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
          assert(alice.conversations.has(conversation.sid));
        }).then(done, done);
      });

      describe('Conversation#disconnect', function() {
        it('updates .conversations', function() {
          conversation.disconnect();
          assert(!alice.conversations.has(conversation.sid));
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
              assert(alice.conversations.has(conversation.sid));
            }).then(function() {
              conversation.disconnect();
            }).then(done, done);
          });
        });

        it('updates .conversations', function() {
          assert(!alice.conversations.has(conversation.sid));
        });
      });
    });
  });

  describe('#inviteToConversation', function() {

    var inviteToConversation = function(name, options) {
      return alice.inviteToConversation(name, options);
    };

    it('should validate an identity was passed', function() {
      assert.throws(inviteToConversation.bind(this), /INVALID_ARGUMENT/);
    });

    it('should update .conversations', function(done) {
      alice.inviteToConversation(uaName).then(function(_conversation) {
        conversation = _conversation;
        assert(alice.conversations.has(conversation.sid));
      }).then(done, done);
      ua.once('invite', function(ist) {
        ist.accept();
      });
    });

    it('should be cancelable', function() {
      var outgoingInvite = alice.inviteToConversation(uaName);
      outgoingInvite.cancel();
      assert.equal('canceled', outgoingInvite.status);
    });

    it('should auto-reject associated invites after it is canceled', function(done) {
      this.timeout(5000);
      var invite;

      ua2Name = randomName();
      ua2Token = getToken({ address: ua2Name });
      ua2Manager = new AccessManager(ua2Token);
      ua2 = new SIPJSUserAgent(ua2Manager, options);

      var i = alice._canceledOutgoingInvites.size;
      ua2.register().then(function() {
        invite = alice.inviteToConversation([uaName, ua2Name]);
        return Promise.all([
          new Promise(function(resolve) {
            ua.once('invite', function() {
              resolve();
            });
          }),
          new Promise(function(resolve) {
            ua2.once('invite', function() {
              resolve();
            });
          })
        ]).then(function() {
          invite.cancel();
          assert.equal(alice._canceledOutgoingInvites.size, i + 1);
        });
      }).then(done, done);
    });

    it('should not reject if primary invitee declines in a multi-invite', function(done) {
      this.timeout(5000);

      ua2Name = randomName();
      ua2Token = getToken({ address: ua2Name });
      ua2Manager = new AccessManager(ua2Token);
      ua2 = new SIPJSUserAgent(ua2Manager, options);

      var ua3Name = randomName();
      var ua3Token = getToken({ address: ua3Name });
      var ua3Manager = new AccessManager(ua3Token);
      var ua3 = new SIPJSUserAgent(ua3Manager, options);

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

      Promise.all([ua2.register(), ua3.register()]).then(function() {
        alice.inviteToConversation([ua2Name, ua3Name])
          .then(function(conversation) {
            conversation2 = conversation;
            done();
          }, done);
      });
    });

    after(function cleanupPending() {
      alice._userAgent.inviteClientTransactions.forEach(function(ict) {
        alice._userAgent.inviteClientTransactions.delete(ict);
        alice._outgoingInvites.delete(ict._cookie);
      });

      if (conversation2) {
        conversation2.disconnect();
        assert(!alice.conversations.has(conversation2.sid));
      }
    });
  });

  describe('#unlisten (while in a Conversation)', function() {
    before(function unlisten() {
      alice.unlisten();
    });

    it('should update .isListening', function() {
      assert(!alice.isListening);
    });

    it('should still need to be registered', function() {
      assert(alice._needsRegistration);
    });
  });

  describe('Conversation#disconnect', function() {
    it('updates .conversations', function() {
      conversation.disconnect();
      assert(!alice.conversations.has(conversation.sid));
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
