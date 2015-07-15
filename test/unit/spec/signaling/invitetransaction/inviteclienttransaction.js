'use strict';

var assert = require('assert');
var InviteClientTransaction = require('lib/signaling/invitetransaction/inviteclienttransaction');

describe('InviteClientTransaction', function() {
  var ict;
  beforeEach(function() {
    ict = new InviteClientTransaction();
  });
  describe('cancel', function() {
    context('when pending', function() {
      it('should set state to canceled', function(done) {
        ict.cancel().then(function() {
          assert(ict.isCanceled);
        }).then(done);
      });
      it('should reject the ICT promise', function(done) {
        ict.then(null, function() {
          assert(ict.isCanceled);
        }).then(done);

        ict.cancel();
      });
    });
    context('when not pending', function() {
      it('should reject with an error', function(done) {
        ict._setRejected();
        ict.cancel().then(null, function() {
          assert(ict.isRejected);
        }).then(done);
      });
    });
  });
});
