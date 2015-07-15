'use strict';

var assert = require('assert');
var InviteServerTransaction = require('lib/signaling/invitetransaction/inviteservertransaction');

describe('InviteServerTransaction', function() {
  var ist;

  this.timeout(50);

  beforeEach(function() {
    ist = new InviteServerTransaction();
  });

  describe('#accept', function() {
    context('when pending', function() {
      it('should set state to accepted', function(done) {
        ist.accept().then(function() {
          assert(ist.isAccepted);
        }).then(done);
      });
      it('should reject the ist promise', function(done) {
        ist.then(null, function() {
          assert(ist.isAccepted);
        }).then(done);

        ist.accept();
      });
    });
    context('when not pending', function() {
      it('should reject with an error', function(done) {
        ist._setCanceled();
        ist.accept().then(null, function() {
          assert(ist.isCanceled);
        }).then(done);
      });
    });
  });

  describe('#reject', function() {
    context('when pending', function() {
      it('should set state to rejected', function(done) {
        ist.reject().then(function() {
          assert(ist.isRejected);
        }).then(done);
      });
      it('should reject the ist promise', function(done) {
        ist.then(null, function() {
          assert(ist.isRejected);
        }).then(done);

        ist.reject();
      });
    });
    context('when not pending', function() {
      it('should reject with an error', function(done) {
        ist._setCanceled();
        ist.reject().then(null, function() {
          assert(ist.isCanceled);
        }).then(done);
      });
    });
  });
});
