'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var util = require('./util');

var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var accountSid = process.env['ACCOUNT_SID'];
var authToken = process.env['AUTH_TOKEN'];
var getCapabilityToken =
  require('../token').getCapabilityToken.bind(null, accountSid, authToken);

describe('SIPJSUserAgent', function() {
  var ua1Name = randomName();
  var token = getCapabilityToken(ua1Name);
  var ua1 = null;

  describe('constructor', function() {
    it('sets .token', function() {
      ua1 = new SIPJSUserAgent(token, { debug: false });
      assert(!ua1.registered);
      assert.equal(token, ua1.token.capabilityTokenString);
    });
  });
  
  describe('#register (without Token)', function() {
    var receivedEvent = false;

    it('updates .registered', function(done) {
      ua1.register().then(function() {
        assert(ua1.registered);
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
        assert.equal(token, ua1.token.capabilityTokenString);
      });

      describe('#register (again, with new Token)', function() {
        ua1Name = randomName();
        token = getCapabilityToken(ua1Name);
        var receivedEvent = false;

        it('updates .registered', function(done) {
          ua1.register(token).then(function() {
            assert(ua1.registered);
          }).then(done, done);
          ua1.once('registered', function() {
            receivedEvent = true;
          });
        });

        it('emits "registered"', function() {
          assert(receivedEvent);
        });

        it('updates .token', function() {
          assert.equal(token, ua1.token.capabilityTokenString);
        });
      });
    });
  });

  var ua2Name = randomName();
  var ua2 = new SIPJSUserAgent(getCapabilityToken(ua2Name), { debug: false });

  describe('Receive incoming call', function() {
    var ist = null;
    var dialog = null;

    it('emits "invite"', function(done) {
      ua2.invite(ua1Name).then(null, function(error) {
        if (ist === null) {
          done(new Error('InviteClientTransaction failed'));
        }
      });
      ua1.once('invite', function(_ist) {
        ist = _ist;
        try {
          assert.equal(ua1, ist.userAgent);
          assert.equal(ua2Name, ist.from.user);
          assert(ist.sid);
        } catch (e) {
          return done(e);
        }
        done();
      });
    });

    it('updates .inviteServerTransactions', function() {
      assert(ua1.inviteServerTransactions.has(ist));
    });

    describe('InviteServerTransaction#accept', function() {
      it('updates .inviteServerTransactions', function(done) {
        ist.accept().then(function(_dialog) {
          assert(!ua1.inviteServerTransactions.has(ist));
          dialog = _dialog;
        }).then(done, done);
      });

      it('updates .dialogs', function() {
        assert(ua1.dialogs.has(dialog));
      });

      describe('Dialog "ended" event', function() {
        it('updates .dialogs', function(done) {
          dialog.end().then(function() {
            assert(!ua1.dialogs.has(dialog));
          }).then(done, done);
        });
      });
    });

    describe('InviteServerTransaction#reject', function() {
      it('updates .inviteServerTransactions', function(done) {
        var ict = ua2.invite(ua1Name);
        ua1.once('invite', function(ist) {
          try {
            assert(ua1.inviteServerTransactions.has(ist));
          } catch (e) {
            return done(e);
          }
          ist.reject().then(function() {
            throw new Error('InviteServerTransaction succeeded');
          }, function(ist) {
            assert(ist.rejected);
            assert(!ua1.inviteServerTransactions.has(ist));
          }).then(done, done);
        });
      });
    });

    describe('InviteServerTransaction canceled', function() {
      it('updates .inviteServerTransactions', function(done) {
        var ict = ua2.invite(ua1Name);
        ua1.once('invite', function(ist) {
          try {
            assert(ua1.inviteServerTransactions.has(ist));
          } catch (e) {
            return done(e);
          }
          ict.cancel().then(function() {
            throw new Error('InviteServerTransaction succeeded');
          }, function(ist) {
            assert(ist.canceled);
            assert(!ua1.inviteServerTransactions.has(ist));
          }).then(done, done);
        });
      });
    });
  });

  describe('#invite', function() {
    var ict = null;
    var ist = null;
    var dialog = null;

    it('returns a SIPJSInviteClientTransaction', function(done) {
      ua2.register().then(function() {
        ict = ua1.invite(ua2Name);
        ict.then(null, function() {
          if (ist === null) {
            done(new Error('InviteClientTransaction failed'));
          }
        });
        ua2.once('invite', function(_ist) {
          ist = _ist;
          done();
        });
        assert(ict);
      }).then(null, done);
    });

    it('updates .inviteClientTransactions', function() {
      assert(ua1.inviteClientTransactions.has(ict));
    });

    describe('InviteClientTransaction accepted', function() {
      it('updates .inviteClientTransactions', function(done) {
        ist.accept().then(function() {
          return ict;
        }).then(function(_dialog) {
          assert(!ua1.inviteClientTransactions.has(ict));
          dialog = _dialog;
        }).then(done, done);
      });

      it('updates .dialogs', function() {
        assert(ua1.dialogs.has(dialog));
      });

      describe('Dialog "ended" event', function() {
        it('updates .dialogs', function(done) {
          dialog.end().then(function() {
            assert(!ua1.dialogs.has(dialog));
          }).then(done, done);
        });
      });
    });

    describe('InviteClientTransaction#cancel', function() {
      it('updates .inviteClientTransactions', function(done) {
        var ict = ua1.invite(ua2Name);
        ua2.once('invite', function(ist) {
          try {
            assert(ua1.inviteClientTransactions.has(ict));
          } catch (e) {
            return done(e);
          }
          ict.cancel().then(function() {
            throw new Error('InviteClientTransaction succeeded');
          }, function(ict) {
            assert(ict.canceled);
            assert(!ua1.inviteClientTransactions.has(ict));
          }).then(done, done);
        });
      });
    });

    describe('InviteClientTransaction rejected', function() {
      it('updates .inviteClientTransactions', function(done) {
        var ict = ua1.invite(ua2Name);
        ua2.once('invite', function(ist) {
          try {
            assert(ua1.inviteClientTransactions.has(ict));
          } catch (e) {
            return done(e);
          }
          ist.reject().then(function() {
            throw new Error('InviteClientTransaction succeeded');
          }, function(ict) {
            assert(ict.rejected);
            assert(!ua1.inviteClientTransactions.has(ict));
          }).then(done, done);
        });
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
