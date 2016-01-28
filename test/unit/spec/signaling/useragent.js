'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var InviteClientTransaction = require('../../../mock/inviteclienttransaction');
var sinon = require('sinon');
var util = require('../../../../lib/util');

var UserAgent = require('../../../../lib/signaling/useragent');

var getToken = require('../../../lib/token').getToken.bind(null, {
  accountSid: 'AC123',
  signingKeySid: 'SK456',
  signingKeySecret: '7890'
});

describe('UserAgent', function() {
  var token = getToken({ address: 'ua1' });
  var accessManager = new AccessManager(token);
  var ua;

  beforeEach(function() {
    ua = new UserAgent(accessManager, {
      inviteClientTransactionFactory: InviteClientTransaction
    });
  });

  describe('new UserAgent(accessManager)', function() {
    it('should set userAgent.accessManager to the supplied AccessManager', function() {
      assert.equal(accessManager, ua.accessManager);
    });
  });

  describe('#connect()', function() {
    context('when disconnected', function() {
      it('should call UserAgent#_connect', function(done) {
        ua._connect = sinon.spy(ua._connect);
        ua.connect().then(function() {
          sinon.assert.calledOnce(ua._connect);
        }).then(done, done);
      });

      context('on success', function() {
        it('should return a Promise that resolves to the UserAgent', function(done) {
          ua.connect().then(function(_ua) {
            assert.equal(ua, _ua);
          }).then(done, done);
        });

        it('should call UserAgent#_onConnectSuccess', function(done) {
          ua._onConnectSuccess = sinon.spy(ua._onConnectSuccess);
          ua.connect().then(function() {
            sinon.assert.calledOnce(ua._onConnectSuccess);
          }).then(done, done);
        });
      });

      context('on failure', function() {
        var error = new Error();

        beforeEach(function() {
          ua._connect = function() { return Promise.reject(error); };
        });

        it('should return a Promise that rejects with an Error', function(done) {
          ua.connect().then(done, function(_error) {
            assert.equal(error, _error);
          }).then(done, done);
        });

        it('should call UserAgent#_onConnectFailure with an Error', function(done) {
          ua._onConnectFailure = sinon.spy(ua._onConnectFailure);
          ua.connect().then(done, function(_error) {
            sinon.assert.calledWith(ua._onConnectFailure, error);
          }).then(done, done);
        });
      });
    });

    context('when connected', function() {
      beforeEach(function(done) {
        ua.connect().then(function() { done(); }, done);
      });

      it('should return a Promise that resolves to the UserAgent', function(done) {
        ua.connect().then(function(_ua) {
          assert.equal(ua, _ua);
        }).then(done, done);
      });

      it('should not call UserAgent#_connect', function(done) {
        ua._connect = sinon.spy(ua._connect);
        ua.connect().then(function() {
          sinon.assert.notCalled(ua._connect);
        }).then(done, done);
      });
    });

    describe('#_onConnectSuccess()', function() {
      it('should set userAgent.isConnected to true', function() {
        ua._onConnectSuccess();
        assert(ua.isConnected);
      });

      it('should emit UserAgent#connected', function(done) {
        ua.once('connected', function() { done(); });
        ua._onConnectSuccess();
      });
    });

    describe('#_onConnectFailure(error)', function() {
      it('should throw the passed error', function() {
        function tryOnConnectFailure() {
          ua._onConnectFailure(new Error('foo'));
        }

        assert.throws(tryOnConnectFailure, /foo/);
      });
    });
  });

  describe('#disconnect()', function() {
    context('when connected', function() {
      beforeEach(function(done) {
        ua.connect().then(function() { done(); }, done);
      });

      it('should call userAgent#_disconnect', function(done) {
        ua._disconnect = sinon.spy(ua._disconnect);
        ua.disconnect().then(function() {
          sinon.assert.calledOnce(ua._disconnect);
        }).then(done, done);
      });

      context('on success', function() {
        it('should return a Promise that resolves to the UserAgent', function(done) {
          ua.disconnect().then(function(_ua) {
            assert.equal(ua, _ua);
          }).then(done, done);
        });

        it('should call UserAgent#_onDisconnectSuccess', function(done) {
          ua._disconnect = sinon.spy(ua._disconnect);
          ua.disconnect().then(function() {
            sinon.assert.calledOnce(ua._disconnect);
          }).then(done, done);
        });
      });

      context('on failure', function() {
        var error = new Error();

        beforeEach(function() {
          ua._disconnect = function() { return Promise.reject(error); };
        });

        it('should return a Promise that rejects with an Error', function(done) {
          ua.disconnect().then(done, function(_error) {
            assert.equal(error, _error);
          }).then(done, done);
        });

        it('should call UserAgent#_onDisconnectFailure with an Error', function(done) {
          ua._onDisconnectFailure = sinon.spy(ua._onDisconnectFailure);
          ua.disconnect().then(done, function() {
            sinon.assert.calledWith(ua._onDisconnectFailure, error);
          }).then(done, done);
        });
      });
    });

    context('when disconnected', function() {
      it('should return a Promise that resolves to the UserAgent', function(done) {
        ua.disconnect().then(function(_ua) {
          assert.equal(ua, _ua);
        }).then(done, done);
      });

      it('should not call userAgent#_disconnect', function(done) {
        ua._disconnect = sinon.spy(ua._disconnect);
        ua.disconnect().then(function() {
          sinon.assert.notCalled(ua._disconnect);
        }).then(done, done);
      });
    });

    describe('#_onDisconnectSuccess()', function() {
      it('should set userAgent.isConnected to false', function() {
        ua._onDisconnectSuccess();
        assert(!ua.isConnected);
      });

      it('should emit UserAgent#disconnected', function(done) {
        ua.once('disconnected', function() { done(); });
        ua._onDisconnectSuccess();
      });
    });

    describe('#_onDisconnectFailure(error)', function() {
      it('should throw the passed error', function() {
        var tryOnDisconnectFailure = function() {
          ua._onDisconnectFailure(new Error('foo'));
        };

        assert.throws(tryOnDisconnectFailure, /foo/);
      });
    });
  });

  describe('#register()', function() {
    context('when unregistered', function() {
      it('should call UserAgent#connect', function(done) {
        ua.connect = sinon.spy(ua.connect);
        ua.register().then(function() {
          sinon.assert.calledOnce(ua.connect);
        }).then(done, done);
      });

      it('should call UserAgent#_register with userAgent.accessManager.token', function(done) {
        ua._register = sinon.spy(ua._register);
        ua.register().then(function() {
          sinon.assert.calledWith(ua._register, ua.accessManager.token);
        }).then(done, done);
      });

      context('on success', function() {
        it('should return a Promise that resolves to the UserAgent', function(done) {
          ua.register().then(function(_ua) {
            assert.equal(ua, _ua);
          }).then(done, done);
        });

        it('should call UserAgent#_onRegisterSuccess', function(done) {
          ua._onRegisterSuccess = sinon.spy(ua._onRegisterSuccess);
          ua.register().then(function() {
            sinon.assert.calledOnce(ua._onRegisterSuccess);
          }).then(done, done);
        });
      });

      context('on failure', function() {
        var error = new Error();

        beforeEach(function() {
          ua._register = function() { return Promise.reject(error); };
        });

        it('should return a Promise that rejects with an Error', function(done) {
          ua.register().then(done, function(_error) {
            assert.equal(error, _error);
          }).then(done, done);
        });

        it('should call UserAgent#_onRegistrationFailure with an Error', function(done) {
          ua._onRegisterFailure = sinon.spy(ua._onRegisterFailure);
          ua.register().then(done, function() {
            sinon.assert.calledWith(ua._onRegisterFailure, error);
          }).then(done, done);
        });
      });
    });

    context('when registered', function() {
      beforeEach(function(done) {
        ua.register().then(function() { done(); }, done);
      });

      it('should return a Promise that resolves to the UserAgent', function(done) {
        ua.register().then(function(_ua) {
          assert.equal(ua, _ua);
        }).then(done, done);
      });

      it('should not call UserAgent#_register', function(done) {
        ua._register = sinon.spy(ua._register);
        ua.register().then(function() {
          sinon.assert.notCalled(ua._register);
        }).then(done, done);
      });
    });

    describe('#_onRegisterSuccess(token)', function() {
      it('should set userAgent.isRegistered to true', function() {
        ua._onRegisterSuccess();
        assert(ua.isRegistered);
      });

      it('should emit UserAgent#registered', function(done) {
        ua.once('registered', function() { done(); });
        ua._onRegisterSuccess();
      });
    });

    describe('#_onRegisterFailure(error)', function(done) {
      it('should throw the passed error', function() {
        function tryOnRegisterFailure() {
          ua._onRegisterFailure(new Error('foo'));
        };

        assert.throws(tryOnRegisterFailure, /foo/);
      });

      it('should emit UserAgent#registrationFailed', function() {
        ua.once('registrationFailed', function() { done(); });

        try {
          ua._onRegisterFailure(new Error());
        } catch(e) { }
      });
    });
  });

  describe('#unregister()', function() {
    context('when registered', function() {
      beforeEach(function(done) {
        ua.register().then(function() { done(); });
      });

      it('should call UserAgent#connect', function(done) {
        ua.connect = sinon.spy(ua.connect);
        ua.unregister().then(function() {
          sinon.assert.calledOnce(ua.connect);
        }).then(done, done);
      });

      it('should call UserAgent#_unregister', function(done) {
        ua._unregister = sinon.spy(ua._unregister);
        ua.unregister().then(function() {
          sinon.assert.calledOnce(ua._unregister);
        }).then(done, done);
      });

      context('on success', function() {
        it('should return a Promise that resolves to the UserAgent', function(done) {
          ua.unregister().then(function(_ua) {
            assert.equal(ua, _ua);
          }).then(done, done);
        });

        it('should call UserAgent#_onRegisterSuccess', function(done) {
          ua._onUnregisterSuccess = sinon.spy(ua._onUnregisterSuccess);
          ua.unregister().then(function() {
            sinon.assert.calledOnce(ua._onUnregisterSuccess);
          }).then(done, done);
        });
      });

      context('on failure', function() {
        var error = new Error();

        beforeEach(function() {
          ua._unregister = function() { return Promise.reject(error); };
        });

        it('should return a Promise that rejects with an Error', function(done) {
          ua.unregister().then(done, function(_error) {
            assert.equal(error, _error);
          }).then(done, done);
        });

        it('should call UserAgent#_onUnregisterFailure with an Error', function(done) {
          ua._onUnregisterFailure = sinon.spy(ua._onUnregisterFailure);
          ua.unregister().then(done, function(_error) {
            sinon.assert.calledWith(ua._onUnregisterFailure, error);
          }).then(done, done);
        });
      });
    });

    context('when unregistered', function() {
      it('should return a Promise that resolves to the UserAgent', function(done) {
        ua.unregister().then(function(_ua) {
          assert.equal(ua, _ua);
        }).then(done, done);
      });

      it('should not call UserAgent#_unregister', function(done) {
        ua._unregister = sinon.spy(ua._unregister);
        ua.unregister().then(function() {
          sinon.assert.notCalled(ua._unregister);
        }).then(done, done);
      });
    });

    describe('#_onUnregisterSuccess()', function() {
      it('should set userAgent.isRegistered to false', function() {
        ua._onUnregisterSuccess();
        assert(!ua.isRegistered);
      });

      it('should emit UserAgent#unregistered', function(done) {
        ua.once('unregistered', function() { done(); });
        ua._onUnregisterSuccess();
      });
    });

    describe('#_onUnregisterFailure(error)', function() {
      it('should throw the passed error', function() {
        var tryOnUnregisterFailure = function() {
          ua._onUnregisterFailure(new Error('foo'));
        };

        assert.throws(tryOnUnregisterFailure, /foo/);
      });
    });
  });

  describe('#invite(address)', function() {
    var dialog;
    var ict;

    beforeEach(function() {
      ua.connect = sinon.spy(ua.connect);
      dialog = new EventEmitter();
      ict = ua.invite('foo');
    });

    it('should return an instance of the supplied InviteClientTransactionFactory', function() {
      assert(ict instanceof InviteClientTransaction);
    });

    it('should add the returned instance to userAgent.inviteClientTransactions', function() {
      assert(ua.inviteClientTransactions.has(ict));
    });

    describe('#_onInviteSuccess(ict, dialog)', function() {
      it('should remove the InviteClientTransaction from userAgent.inviteClientTransactions', function() {
        ua._onInviteSuccess(ict, dialog);
        assert(!ua.inviteClientTransactions.has(ict));
      });

      it('should add the Dialog to userAgent.dialogs', function() {
        ua._onInviteSuccess(ict, dialog);
        assert(ua.dialogs.has(dialog));
      });
    });

    describe('#_onInviteFailure(ict, error)', function() {
      it('should remove the InviteClientTransaction from userAgent.inviteClientTransactions', function() {
        try {
          ua._onInviteFailure(ict, new Error('foo'));
        } catch(e) { }

        assert(!ua.inviteClientTransactions.has(ict));
      });

      it('should throw the Error', function() {
        function tryOnInviteFailure() {
          ua._onInviteFailure(ict, new Error('foo'));
        };

        assert.throws(tryOnInviteFailure, /foo/);
      });
    });
  });

  describe('#_handleInviteServerTransaction(ist)', function() {
    var ist = Promise.resolve();

    it('should emit UserAgent#invite', function(done) {
      ua.once('invite', function() { done(); });
      ua._handleInviteServerTransaction(ist);
    });

    it('should add the InviteServerTransaction to userAgent.inviteServerTransactions', function() {
      ua._handleInviteServerTransaction(ist);
      assert(ua.inviteServerTransactions.has(ist));
    });

    describe('#_onAcceptSuccess(ist, dialog)', function() {
      var dialog = new EventEmitter();

      beforeEach(function() {
        ua._handleInviteServerTransaction(ist)
      });

      it('should remove the InviteServerTransaction from userAgent.inviteServerTransactions', function() {
        ua._onAcceptSuccess(ist, dialog);
        assert(!ua.inviteServerTransactions.has(ist));
      });

      it('should add the Dialog to userAgent.dialogs', function() {
        ua._onAcceptSuccess(ist, dialog);
        assert(ua.dialogs.has(dialog));
      });
    });

    describe('#_onAcceptFailure(ist, error)', function() {
      beforeEach(function() {
        ua._handleInviteServerTransaction(ist);
      });

      it('should remove the InviteServerTransaction from userAgent.inviteServerTransactions', function() {
        ua._onAcceptFailure(ist)
        assert(!ua.inviteServerTransactions.has(ist));
      });
    });
  });

  describe('#_dialogCreated(dialog)', function() {
    var dialog;
    var deferred;
    var ist;

    beforeEach(function() {
      dialog = new EventEmitter();
      deferred = util.defer();
      ist = deferred.promise;
      ua._handleInviteServerTransaction(ist)
    });

    it('should add the supplied dialog to userAgent.dialogs', function() {
      ua._dialogCreated(dialog);
      assert(ua.dialogs.has(dialog));
    });

    it('should fire the UserAgent#_dialogCreated event when invoked', function(done) {
      ua.once('dialogCreated', function() { done(); });
      ua._dialogCreated(dialog);
    });

    it('should fire the UserAgent#dialogDisconnected event when dialog emits Dialog#disconnected', function(done) {
      ua._dialogCreated(dialog);
      ua.once('dialogDisconnected', function() { done(); });
      dialog.emit('disconnected');
    });

    it('should fire the UserAgent#dialogFailed event when dialog emits Dialog#failed', function(done) {
      ua._dialogCreated(dialog);
      ua.once('dialogFailed', function() { done(); });
      dialog.emit('failed');
    });

    it('should fire the UserAgent#dialogEnded event when dialog emits Dialog#ended', function(done) {
      ua._dialogCreated(dialog);
      ua.once('dialogEnded', function() { done(); });
      dialog.emit('ended', dialog);
    });

    it('should remove the dialog from UserAgent.dialogs when dialog emits Dialog#failed', function() {
      ua._dialogCreated(dialog);
      dialog.emit('failed');
      assert(!ua.dialogs.has(dialog));
    });

    it('should remove the dialog from UserAgent.dialogs when dialog emits Dialog#ended', function() {
      ua._dialogCreated(dialog);
      dialog.emit('ended', dialog);
      assert(!ua.dialogs.has(dialog));
    });
  });
});
