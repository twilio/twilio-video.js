'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var util = require('./util');

var UserAgent = require('../../lib/signaling/useragent');
var Token = require('../../lib/accesstoken');

var config = require('../../test');
var accountSid = config['accountSid'];
var signingKeySid = config['signingKeySid'];
var signingKeySecret = config['signingKeySecret'];
var getToken = require('../token').getToken.bind(null, accountSid,
  signingKeySid, signingKeySecret);

describe('UserAgent', function() {
  var token = getToken('ua1');
  var ua1 = null;

  describe('constructor', function() {
    it('sets .token', function() {
      ua1 = new UserAgent(token);
      assert(!ua1.registered);
      assert.equal(token, ua1.token);
    });
  });

  describe('#register (without Token)', function() {
    var receivedEvent = false;

    it('updates .isRegistered', function(done) {
      ua1.register().then(function() {
        assert(ua1.isRegistered);
      }).then(done, done);
      ua1.once('registered', function() {
        receivedEvent = true;
      });
    });

    it('emits "registered"', function() {
      assert(receivedEvent);
    });

    describe('#unregister', function() {
      var receivedEvent = false;

      it('updates .registered', function(done) {
        ua1.unregister().then(function() {
          assert(!ua1.registered);
        }).then(done, done);
        ua1.once('unregistered', function() {
          receivedEvent = true;
        });
      });

      it('emits "unregistered"', function() {
        assert(receivedEvent);
      });

      it('does not update .token', function() {
        assert.equal(token, ua1.token);
      });

      describe('#register (again, with new Token)', function() {
        token = getToken('ua1');
        var receivedEvent = false;

        it('updates .isRegistered', function(done) {
          ua1.register(token).then(function() {
            assert(ua1.isRegistered);
          }).then(done, done);
          ua1.once('registered', function() {
            receivedEvent = true;
          });
        });

        it('emits "registered"', function() {
          assert(receivedEvent);
        });

        it('updates .token', function() {
          assert.equal(token, ua1.token);
        });
      });
    });
  });

  describe('Receive incoming call', function() {
    var dialog = new EventEmitter();
    var ist = Q.defer();
    EventEmitter.call(ist.promise);

    ist.callSid = dialog.callSid = 'CA123';
    ist.conversationSid = dialog.conversationSid = 'CO456';

    it('emits "invite"', function(done) {
      ua1._handleInviteServerTransaction(ist.promise)
      ua1.once('invite', done.bind(null, null));
    });

    it('updates .inviteServerTransactions', function() {
      assert(ua1.inviteServerTransactions.has(ist.promise));
    });

    it('inviteServerTransaction.callSid', function() {
      assert(ist.callSid);
    });

    it('inviteServerTransaction.conversationSid', function() {
      assert(ist.conversationSid);
    });

    describe('InviteServerTransaction#accept', function() {
      it('updates .inviteServerTransactions', function(done) {
        ist.promise.then(function() {
          assert(!ua1.inviteServerTransactions.has(ist.promise));
        }).then(done, done);
        ist.resolve(dialog);
      });

      it('updates .dialogs', function() {
        assert(ua1.dialogs.has(dialog));
      });

      it('dialog.callSid', function() {
        assert(dialog.callSid);
      });

      it('dialog.conversationSid', function() {
        assert(dialog.conversationSid);
      });

      describe('Dialog "ended" event', function() {
        it('updates .dialogs', function() {
          dialog.emit('ended', dialog);
          assert(!ua1.dialogs.has(dialog));
        });
      });
    });

    // FIXME(mroberts): The reject/canceled tests could be better.

    describe('InviteServerTransaction#reject', function() {
      var dialog = new EventEmitter();
      var ist = Q.defer();
      EventEmitter.call(ist.promise);

      it('updates .inviteServerTransactions', function(done) {
        ua1._handleInviteServerTransaction(ist.promise)
        ua1.once('invite', function() {
          try {
            assert(ua1.inviteServerTransactions.has(ist.promise));
          } catch (e) {
            return done(e);
          }
          ist.promise.failed = true;
          ist.reject(ist.promise);
          ist.promise.then(null, function() {
            assert(!ua1.inviteServerTransactions.has(ist.promise));
          }).then(done, done);
        });
      });
    });

    describe('InviteServerTransaction canceled', function() {
      var dialog = new EventEmitter();
      var ist = Q.defer();
      EventEmitter.call(ist.promise);

      it('updates .inviteServerTransactions', function(done) {
        ua1._handleInviteServerTransaction(ist.promise)
        ua1.once('invite', function() {
          try {
            assert(ua1.inviteServerTransactions.has(ist.promise));
          } catch (e) {
            return done(e);
          }
          ist.promise.canceled = true;
          ist.reject(ist.promise);
          ist.promise.then(null, function() {
            assert(!ua1.inviteServerTransactions.has(ist.promise));
          }).then(done, done);
        });
      });
    });
  });

  describe('#invite', function() {
    var dialog = new EventEmitter();
    var ict = null;

    dialog.callSid = 'CA123';
    dialog.conversationSid = 'CO123';

    it ('returns an InviteClientTransaction', function() {
      ict = ua1.invite('foo');
      assert(ict);
    });

    it('updates .inviteClientTransactions', function() {
      assert(ua1.inviteClientTransactions.has(ict));
    });

    describe('InviteClientTransaction accepted', function() {
      it('updates .inviteClientTransactions', function(done) {
        ict.once('accepted', function() {
          try {
            assert(!ua1.inviteClientTransactions.has(ict));
          } catch (e) {
            return done(e);
          }
          done();
        });
        ict._deferred.resolve(dialog);
      });

      it('updates .dialogs', function() {
        assert(ua1.dialogs.has(dialog));
      });

      it('dialog.callSid', function() {
        assert(dialog.callSid);
      });

      it('dialog.conversationSid', function() {
        assert(dialog.conversationSid);
      });

      describe('Dialog "ended" event', function() {
        it('updates .dialogs', function() {
          dialog.emit('ended', dialog);
          assert(!ua1.dialogs.has(dialog));
        });
      });
    });

    describe('InviteClientTransaction#cancel', function() {
      var dialog = new EventEmitter();
      var ict = null;

      it('updates .inviteClientTransactions', function(done) {
        ict = ua1.invite('foo');
        assert(ua1.inviteClientTransactions.has(ict));
        ict._canceled = true;
        ict._deferred.reject(ict);
        ict.once('canceled', function() {
          try {
            assert(!ua1.inviteClientTransactions.has(ict));
          } catch (e) {
            return done(e);
          }
          done();
        });
      });
    });

    describe('InviteClientTransaction rejected', function() {
      var dialog = new EventEmitter();
      var ict = null;

      it('updates .inviteClientTransactions', function(done) {
        ict = ua1.invite('foo');
        assert(ua1.inviteClientTransactions.has(ict));
        ict._failed = true;
        ict._deferred.reject(ict);
        ict.once('failed', function() {
          try {
            assert(!ua1.inviteClientTransactions.has(ict));
          } catch (e) {
            return done(e);
          }
          done();
        });
      });
    });
  });
});
