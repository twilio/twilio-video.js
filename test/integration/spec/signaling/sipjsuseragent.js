'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('lib/util');

var SIPJSUserAgent = require('lib/signaling/sipjsuseragent');

var credentials = require('test/env');
var getToken = require('test/lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('SIPJSUserAgent', function() {
  var ua1Name = randomName();
  var token = getToken({ address: ua1Name });
  var accessManager = new AccessManager(token);
  var ua1 = null;

  var options = {};
  options['logLevel'] = 'off';
  options['wsServer'] = wsServer;
  var inviteOptions = {};

  describe('constructor', function() {
    before(function() {
      ua1 = new SIPJSUserAgent(accessManager, options);
    });

    it('should set .accessManager', function() {
      assert.equal(accessManager, ua1.accessManager);
    });

    it('should not automatically connect', function() {
      assert(!ua1.isConnected);
    });

    it('should not automatically register', function() {
      assert(!ua1.registered);
    });
  });

  describe('#register()', function() {
    var receivedEvent = false;

    it('should register when not connected', function(done) {
      ua1.register().then(function() {
        assert(ua1.isRegistered);
      }).then(done, done);

      ua1.once('registered', function() {
        receivedEvent = true;
      });
    });

    it('should emit "registered" event', function() {
      assert(receivedEvent);
    });

    it('should register when already connected', function(done) {
      ua1 = new SIPJSUserAgent(accessManager, options);
      ua1.connect().then(function() {
        return ua1.register();
      }).then(function() {
        assert(ua1.isRegistered);
      }).then(done, done);
    });

    describe('#unregister', function() {
      var receivedEvent = false;

      it('should update .registered', function(done) {
        ua1.unregister().then(function() {
          assert(!ua1.registered);
        }).then(done, done);
        ua1.once('unregistered', function() {
          receivedEvent = true;
        });
      });

      it('should emit "unregistered" event', function() {
        assert(receivedEvent);
      });

      describe('#register()', function() {
        var receivedEvent = false;

        it('should register', function(done) {
          ua1.register().then(function() {
            assert(ua1.isRegistered);
          }).then(done, done);
          ua1.once('registered', function() {
            receivedEvent = true;
          });
        });

        it('should emit "registered" event', function() {
          assert(receivedEvent);
        });
      });
    });
  });

  var ua2Name = randomName();
  var ua2 = new SIPJSUserAgent(new AccessManager(getToken({ address: ua2Name })), { 'wsServer': wsServer, 'logLevel': 'off' });

  describe('ua2.invite(ua1Name)', function() {
    var ua2Ict = null;
    var ua1Ist = null;

    before(function ua2CallsUA1(done) {
      ua2.connect().then(function() {
        ua2Ict = ua2.invite(ua1Name, inviteOptions);
      });
      ua1.once('invite', function(ist) {
        ua1Ist = ist;
        done();
      });
    });

    it('ua1 emits "invite"', function() {
      // Do nothing
    });

    it('updates ua1.inviteServerTransactions', function() {
      assert(ua1.inviteServerTransactions.has(ua1Ist));
    });

    it('updates ua2.inviteClientTransactions', function() {
      assert(ua2.inviteClientTransactions.has(ua2Ict));
    });

    describe('InviteServerTransaction', function() {
      it('.callSid', function() {
        assert(ua1Ist.callSid);
      });

      it('.conversationSid', function() {
        assert(ua1Ist.conversationSid);
      });

      it('.userAgent', function() {
        assert.equal(ua1, ua1Ist.userAgent);
      });

      it('.from', function() {
        assert.equal(ua2Name, util.getUser(ua1Ist.from));
      });

      describe('#accept', function() {
        var ua1Dialog = null;
        var ua2Dialog = null;

        this.timeout(0);

        before(function(done) {
          Promise.all([
            ua2Ict.then(function(dialog) {
              ua2Dialog = dialog;
            }),
            ua1Ist.accept().then(function(dialog) {
              ua1Dialog = dialog;
            })
          ]).then(function() {
            done();
          }, done);
        });

        it('updates ua1.inviteServerTransactions', function() {
          assert(!ua1.inviteServerTransactions.has(ua1Ist));
        });

        it('updates ua2.inviteClientTransactions', function() {
          assert(!ua2.inviteClientTransactions.has(ua2Ict));
        });

        it('updates .dialogs', function() {
          assert(ua1.dialogs.has(ua1Dialog));
        });

        it('dialog.callSid', function() {
          assert(ua1Dialog.callSid);
        });

        it('dialog.conversationSid', function() {
          assert(ua1Dialog.conversationSid);
        });

        describe('Dialog "ended" event', function() {
          it('updates .dialogs', function(done) {
            ua1Dialog.end();
            assert(!ua1.dialogs.has(ua1Dialog));
            ua2Dialog.once('ended', function() {
              try {
                assert(!ua2.dialogs.has(ua2Dialog));
              } catch(e) {
                return done(e);
              }
              done();
            });
          });
        });
      });

    });

    /*
    describe('InviteServerTransaction#reject', function() {
      var ua2Ict = null;
      var ua1Ist = null;

      it('updates .inviteServerTransactions', function(done) {
        this.timeout(0);
        ua2Ict = ua2.invite(ua1Name, inviteOptions);
        ua2Ict.then(null, function(error) {
          if (ua1Ist === null) {
            return done(new Error('InviteClientTransaction failed'));
          }
          done();
        });
        ua1.once('invite', function(ist) {
          ua1Ist = ist;
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
          }).then(null, done);
        });
      });
    });
    */

    describe('InviteServerTransaction#reject', function() {
      it('updates .inviteServerTransactions', function(done) {
        this.timeout(0);
        var ua2Ict = ua2.invite(ua1Name, inviteOptions);
        ua1.once('invite', function(ist) {
          ua1Ist = ist;
          try {
            assert(ua1.inviteServerTransactions.has(ua1Ist));
          } catch (e) {
            return done(e);
          }
          ua1Ist.reject().then(function() {
            done();
          }, function() {
            assert.equal(ua1Ist.state, 'rejected');
            assert(!ua1.inviteServerTransactions.has(ua1Ist));
            done();
          }).then(null, done);
        });
      });
    });

    describe('InviteServerTransaction canceled', function() {
      it('updates .inviteServerTransactions', function(done) {
        var ua2Ict = ua2.invite(ua1Name, inviteOptions);
        ua1.once('invite', function(ist) {
          ua1Ist = ist;
          try {
            assert(ua1.inviteServerTransactions.has(ua1Ist));
          } catch (e) {
            return done(e);
          }
          ua2Ict.cancel().then(done, function() {
            ua1Ist.then(done, function() {
              assert.equal(ua1Ist.state, 'canceled');
              assert(!ua1.inviteServerTransactions.has(ua1Ist));
            }).then(done, done);
          });
        });
      });

      it.skip('should cancel the request after receiving 100 if called prior', function(done) {
        var ua2Ict = ua2.invite(ua1Name, inviteOptions);

        ua1.once('invite', function(ist) {
          ist.then(function() {
            throw Error('Invite was not canceled');
          }, function() {
            assert.equal(ist.state, 'canceled');
          }).then(done, done);
        });

        var sessionPoll = setInterval(function() {
          if(!ua2Ict.session) { return; }

          ua2Ict.cancel();
          clearInterval(sessionPoll);
        }, 10);
      });

      it('should not send the request if cancelled prior', function(done) {
        var ua2Ict = ua2.invite(ua1Name, inviteOptions);
        ua2Ict.cancel();

        ua2Ict.then(function() {
          throw Error('Invite was not canceled');
        }, function() {
          assert.equal(ua2Ict.state, 'canceled');
        }).then(done, done);
      });
    });
  });

  /*
  describe('#invite', function() {
    var ict = null;
    var ist = null;
    var ua1Dialog = null;
    var ua2Dialog = null;

    it('returns a SIPJSInviteClientTransaction', function(done) {
      // FIXME(mroberts): ...
      // ua2.register().then(function() {
        ict = ua1.invite(ua2Name, inviteOptions);
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
      // }).then(null, done);
    });

    it('updates .inviteClientTransactions', function() {
      assert(ua1.inviteClientTransactions.has(ict));
    });

    describe('InviteClientTransaction accepted', function() {
      it('updates .inviteClientTransactions', function(done) {
        Promise.all([
          ict.then(function(_dialog) {
            assert(!ua1.inviteClientTransactions.has(ict));
            ua1Dialog = _dialog;
          }),
          ist.accept().then(function(_dialog) {
            ua2Dialog = _dialog;
          })
        ]).then(function() {
          done();
        }, done);
      });

      it('updates .dialogs', function() {
        assert(ua1.dialogs.has(ua1Dialog));
      });

      it('dialog.callSid', function() {
        assert(ua1Dialog.callSid);
      });

      it('dialog.conversationSid', function() {
        assert(ua1Dialog.conversationSid);
      });

      describe('Dialog "ended" event', function() {
        it('updates .dialogs', function(done) {
          ua1Dialog.end().then(function() {
            assert(!ua1.dialogs.has(ua1Dialog));
          }).then(done, done);
          ua2Dialog.end().then(function() {
            assert(!ua2.dialog.has(ua2Dialog));
          });
        });
      });
    });

    describe('InviteClientTransaction#cancel', function() {
      it('updates .inviteClientTransactions', function(done) {
        var ict = ua1.invite(ua2Name, inviteOptions);
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
        var ict = ua1.invite(ua2Name, inviteOptions);
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
  */
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
