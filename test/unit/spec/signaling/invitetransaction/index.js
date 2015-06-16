'use strict';

var assert = require('assert');
var InviteTransaction = require('lib/signaling/invitetransaction/index');

describe('InviteTransaction', function() {
  var invite;

  beforeEach(function() {
    invite = new InviteTransaction();
  });

  describe('new InviteTransaction(userAgent)', function() {
    it('should return an instance of InviteTransaction', function() {
      assert(invite instanceof InviteTransaction);
    });
  });

  describe('#_checkInviteTransactionState(inviteTransaction)', function() {
    it('should throw an error if the transaction is accepted', function() {
      invite._accepted = true;
      assert.throws(InviteTransaction._checkInviteTransactionState.bind(null, invite));
    });

    it('should throw an error if the transaction is canceled', function() {
      invite._canceled = true;
      assert.throws(InviteTransaction._checkInviteTransactionState.bind(null, invite));
    });

    it('should throw an error if the transaction is rejected', function() {
      invite._rejected = true;
      assert.throws(InviteTransaction._checkInviteTransactionState.bind(null, invite));
    });

    it('should throw an error if the transaction is failed', function() {
      invite._failed = true;
      assert.throws(InviteTransaction._checkInviteTransactionState.bind(null, invite));
    });

    it('should not throw an error if the transaction has not been resolved', function() {
      try {
        InviteTransaction._checkInviteTransactionState(invite);
      } catch(e) {
        assert(false);
      }
    });
  });

  describe('#then(onResolve, onReject)', function() {
    it('should pass a Dialog to onResolve if the Promise resolves', function(done) {
      invite.then(function(dialog) {
        assert.equal(dialog, 'foo');
      }).then(done, done);

      invite._deferred.resolve('foo');
    });

    it('should run onReject with the reason if the Promise is rejected', function(done) {
      invite.then(null, function(reason) {
        assert.equal(reason, 'foo');
      }).then(done, done);
      invite._deferred.reject('foo');
    });
  });

  describe('events', function() {
    it('should emit "accepted" with a Dialog if the Promise is fulfilled', function(done) {
      invite.on('accepted', function(dialog) {
        assert.equal(dialog, 'foo');
        done();
      });

      invite._deferred.resolve('foo');
    });

    it('should emit "canceled" if the Promise is rejected and the canceled flag is set', function(done) {
      invite.on('canceled', function() { done(); });
      invite._canceled = true;
      invite._deferred.reject();
    });

    it('should emit "rejected" if the Promise is rejected and the rejected flag is set', function(done) {
      invite.on('rejected', function() { done(); });
      invite._rejected = true;
      invite._deferred.reject();
    });

    it('should emit "failed" if the Promise is rejected and neither canceled nor rejected flags are set', function(done) {
      invite.on('failed', function() { done(); });
      invite._deferred.reject();
    });
  });
});
