'use strict';

var assert = require('assert');
var InviteClientTransaction = require('../../../../../lib/signaling/v1/inviteclienttransaction');

describe('InviteClientTransaction', function() {
  var ict;
  beforeEach(function() {
    ict = new InviteClientTransaction();
  });
  describe('cancel', function() {
    context('when pending', function() {
      it('should set state to canceled', function() {
        ict.cancel();
        assert(ict.isCanceled);
      });
      it('should reject the ICT promise', function(done) {
        ict.then(null, function() {
          assert(ict.isCanceled);
        }).then(done);

        ict.cancel();
      });
    });
    context('when not pending', function() {
      it('should throw an Error', function() {
        ict._setRejected();
        assert.throws(ict.cancel.bind(ict));
        assert(ict.isRejected);
      });
    });
  });
});
