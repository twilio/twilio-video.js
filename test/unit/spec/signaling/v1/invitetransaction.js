'use strict';

var assert = require('assert');
var InviteTransaction = require('../../../../../lib/signaling/v1/invitetransaction');

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

  describe('_setState', function() {
    it('should throw an error if the state is not supplied', function() {
      assert.throws(invite._setState.bind(invite));
    });

    it('should throw an error if the state is invalid', function() {
      assert.throws(invite._setState.bind(invite, 'foobar'));
    });

    it('should return false and not change state if state has already been set', function() {
      invite._setState('rejected');
      assert(!invite._setState('failed'));
      assert(invite.state, 'rejected');
    });

    it('should set and return true if valid', function() {
      assert(invite._setState('accepted'));
      assert(invite.state, 'accepted');
    });
  });

  describe('_setAccepted', function() {
    it('should set .state to InviteTransaction.ACCEPTED', function() {
      invite._setAccepted();
      assert.equal(invite.state, InviteTransaction.ACCEPTED);
    });
  });

  describe('_setRejected', function() {
    it('should set .state to InviteTransaction.REJECTED', function() {
      invite._setRejected();
      assert.equal(invite.state, InviteTransaction.REJECTED);
    });
  });

  describe('_setCanceled', function() {
    it('should set .state to InviteTransaction.CANCELED', function() {
      invite._setCanceled();
      assert.equal(invite.state, InviteTransaction.CANCELED);
    });
  });

  describe('_setFailed', function() {
    it('should set .state to InviteTransaction.FAILED', function() {
      invite._setFailed();
      assert.equal(invite.state, InviteTransaction.FAILED);
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
      invite._setCanceled()
      invite._deferred.reject();
    });

    it('should emit "rejected" if the Promise is rejected and the rejected flag is set', function(done) {
      invite.on('rejected', function() { done(); });
      invite._setRejected();
      invite._deferred.reject();
    });

    it('should emit "failed" if the Promise is rejected and neither canceled nor rejected flags are set', function(done) {
      invite.on('failed', function() { done(); });
      invite._deferred.reject();
    });
  });
});
