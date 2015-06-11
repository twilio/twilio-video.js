'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var MockICT = require('../../mock/inviteclienttransaction');
var sinon = require('sinon');
var Q = require('q');

var UserAgent = require('../../../../lib/signaling/useragent');

var getToken = require('../../../lib/token').getToken.bind(null, {
  accountSid: 'AC123',
  signingKeySid: 'SK456',
  signingKeySecret: '7890'
});

describe('UserAgent', function() {
  var token = getToken({ address: 'ua1' });
  var ua;

  beforeEach(function() {
    ua = new UserAgent(token, {
      inviteClientTransactionFactory: MockICT
    });
  });

  describe('constructor', function() {
    it('should set the userAgent.token property with the supplied token', function() {
      assert.equal(token, ua.token);
    });

    it('should initially set userAgent.isRegistered to false', function() {
      assert(!ua.isRegistered);
    });
  });

  describe('#connect()', function() {
    it('should return a promise that is fulfilled', function(done) {
      ua.connect().then(function() { done(); });
    });

    it('should call userAgent#_connect', function() {
      ua._connect = sinon.spy(ua._connect);
      ua.connect();
      sinon.assert.calledOnce(ua._connect);
    });

    it('should set userAgent.isConnected to true', function(done) {
      ua.connect().then(function() {
        assert(ua.isConnected);
        done();
      });
    });

    it('should call userAgent._onConnectSuccess only if not already connected', function(done) {
      ua._onConnectSuccess = sinon.spy(ua._onConnectSuccess);
      ua.connect().then(function() {
        return ua.connect();
      }).then(function() {
        sinon.assert.calledOnce(ua._onConnectSuccess);
        done();
      });
    });

    describe('#_connect()', function() {
      it('should return a promise that is fulfilled', function(done) {
        ua._connect().then(function() { done(); });
      });
    });

    describe('#_onConnectSuccess()', function() {
      it('should set userAgent.isConnected to true on success', function() {
        ua._onConnectSuccess();
        assert(ua.isConnected);
      });

      it('should emit UserAgent#connected', function(done) {
        ua.once('connected', function() { done(); });
        ua._onConnectSuccess();
      });
    });

    describe('#_onConnectFailure()', function() {
      it('should throw the passed error', function() {
        var tryOnConnectFailure = function() {
          ua._onConnectFailure(new Error('foo'));
        };

        assert.throws(tryOnConnectFailure, /foo/);
      });
    });
  });

  describe('#disconnect()', function() {
    beforeEach(function(done) {
      ua.connect().then(function() { done(); });
    });

    it('should return a promise that is fulfilled', function(done) {
      ua.disconnect().then(function() { done(); });
    });

    it('should call userAgent#_disconnect', function() {
      ua._disconnect = sinon.spy(ua._disconnect);
      ua.disconnect();
      sinon.assert.calledOnce(ua._disconnect);
    });

    it('should set userAgent.isConnected to false', function(done) {
      ua.disconnect().then(function() {
        assert(!ua.isConnected);
      }).then(done, done);
    });

    it('should call userAgent._onDisconnectSuccess only if already connected', function(done) {
      ua._onDisconnectSuccess = sinon.spy(ua._onDisconnectSuccess);
      ua.disconnect().then(function() {
        return ua.disconnect();
      }).then(function() {
        sinon.assert.calledOnce(ua._onDisconnectSuccess);
      }).then(done, done);
    });

    describe('#_disconnect()', function() {
      it('should return a promise that is fulfilled', function(done) {
        ua._disconnect().then(function() { done(); });
      });
    });

    describe('#_onDisconnectSuccess()', function() {
      it('should set userAgent.isConnected to false on success', function() {
        ua._onDisconnectSuccess();
        assert(!ua.isConnected);
      });

      it('should emit UserAgent#disconnected', function(done) {
        ua.once('disconnected', function() { done(); });
        ua._onDisconnectSuccess();
      });
    });

    describe('#_onDisconnectFailure()', function() {
      it('should throw the passed error', function() {
        var tryOnDisconnectFailure = function() {
          ua._onDisconnectFailure(new Error('foo'));
        };

        assert.throws(tryOnDisconnectFailure, /foo/);
      });
    });
  });

  describe('#register(token)', function() {
    it('should return a promise that is fulfilled', function(done) {
      ua.register().then(function() { done(); });
    });

    it('should call userAgent#_register with passed token', function() {
      var newToken = getToken({ address: 'ua2' });
      ua._register = sinon.spy(ua._register);
      ua.register(newToken);
      sinon.assert.calledWith(ua._register, newToken);
    });

    it('should call userAgent#_register with UserAgent#token if not supplied', function() {
      ua._register = sinon.spy(ua._register);
      ua.register();
      sinon.assert.calledWith(ua._register, ua.token);
    });

    describe('#_register(token)', function() {
      it('should return a promise that is fulfilled', function(done) {
        ua._register().then(function() { done(); });
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

      it('should update userAgent.token', function() {
        var newToken = getToken({ address: 'ua2' });
        ua._onRegisterSuccess(newToken);
        assert.equal(ua.token, newToken);
      });
    });

    describe('#_onRegisterFailure()', function() {
      it('should emit UserAgent#registrationFailed', function() {
        ua.once('registrationFailed', function() { done(); });

        try {
          ua._onRegisterFailure(new Error('foo'));
        } catch(e) { }
      });

      it('should throw the passed error', function() {
        var tryOnRegisterFailure = function() {
          ua._onRegisterFailure(new Error('foo'));
        };

        assert.throws(tryOnRegisterFailure, /foo/);
      });
    });
  });

  describe('#unregister()', function() {
    beforeEach(function(done) {
      ua.register().then(function() { done(); });
    });

    it('should return a promise that is fulfilled', function(done) {
      ua.unregister().then(function() { done(); });
    });

    it('should call userAgent#_unregister', function() {
      ua._unregister = sinon.spy(ua._unregister);
      ua.unregister();
      sinon.assert.calledOnce(ua._unregister);
    });

    describe('#_unregister()', function() {
      it('should return a promise that is fulfilled', function(done) {
        ua._unregister().then(function() { done(); });
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

    describe('#_onUnregisterFailure()', function() {
      it('should throw the passed error', function() {
        var tryOnUnregisterFailure = function() {
          ua._onUnregisterFailure(new Error('foo'));
        };

        assert.throws(tryOnUnregisterFailure, /foo/);
      });
    });
  });

  describe('#_handleInviteServerTransaction(ist)', function() {
    var ist = Q.defer().promise;

    it('should emit UserAgent#invite when invoked', function(done) {
      ua.once('invite', function() { done(); });
      ua._handleInviteServerTransaction(ist);
    });

    it('should add the supplied promise to userAgent.inviteServerTransactions', function() {
      ua._handleInviteServerTransaction(ist);
      assert(ua.inviteServerTransactions.has(ist));
    });

    describe('#_onAcceptSuccess(ist, dialog)', function() {
      var dialog;
      var deferred;
      var ist;

      beforeEach(function() {
        dialog = new EventEmitter();
        deferred = Q.defer();
        ist = deferred.promise;
        ua._handleInviteServerTransaction(ist)
      });

      it('should remove the supplied promise from userAgent.inviteServerTransactions', function() {
        ua._onAcceptSuccess(ist, dialog);
        assert(!ua.inviteServerTransactions.has(ist));
      });
    });

    describe('#_onAcceptFailure(ist, error)', function() {
      var dialog;
      var deferred;
      var ist;

      beforeEach(function() {
        dialog = new EventEmitter();
        deferred = Q.defer();
        ist = deferred.promise;
        ua._handleInviteServerTransaction(ist)
      });

      it('should remove the promise from userAgent.inviteServerTransactions', function() {
        try {
          ua._onAcceptFailure(ist, new Error('foo'));
        } catch(e) { }

        assert(!ua.inviteServerTransactions.has(ist));
      });

      it('should throw the passed error', function() {
        var tryOnAcceptFailure = function() {
          ua._onAcceptFailure(ist, new Error('foo'));
        };

        assert.throws(tryOnAcceptFailure, /foo/);
      });
    });
  });

  describe('#invite(address, options)', function() {
    var dialog;
    var ict;

    beforeEach(function() {
      dialog = new EventEmitter();
      ict = ua.invite('foo');
    });

    it('should return an instance of the supplied InviteClientTransactionFactory', function() {
      assert(ict instanceof MockICT);
    });

    it('should add the returned instance to userAgent.inviteClientTransactions', function() {
      assert(ua.inviteClientTransactions.has(ict));
    });

    describe('#_onInviteSuccess(ict, dialog)', function() {
      it('should remove the ICT from userAgent.inviteClientTransactions', function() {
        ua._onInviteSuccess(ict, dialog);
        assert(!ua.inviteClientTransactions.has(ict));
      });

      it('should add the passed dialog to userAgent.dialogs', function() {
        ua._onInviteSuccess(ict, dialog);
        assert(ua.dialogs.has(dialog));
      });
    });

    describe('#_onInviteFailure(ict, error)', function() {
      it('should remove the promise from userAgent.inviteClientTransactions', function() {
        try {
          ua._onInviteFailure(ict, new Error('foo'));
        } catch(e) { }

        assert(!ua.inviteClientTransactions.has(ict));
      });

      it('should throw the passed error', function() {
        var tryOnInviteFailure = function() {
          ua._onInviteFailure(ict, new Error('foo'));
        };

        assert.throws(tryOnInviteFailure, /foo/);
      });
    });
  });

  describe('#_dialogCreated(dialog)', function() {
    var dialog;
    var deferred;
    var ist;

    beforeEach(function() {
      dialog = new EventEmitter();
      deferred = Q.defer();
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
      dialog.emit('ended');
    });

    it('should remove the dialog from UserAgent.dialogs when dialog emits Dialog#failed', function() {
      ua._dialogCreated(dialog);
      dialog.emit('failed');
      assert(!ua.dialogs.has(dialog));
    });

    it('should remove the dialog from UserAgent.dialogs when dialog emits Dialog#ended', function() {
      ua._dialogCreated(dialog);
      dialog.emit('ended');
      assert(!ua.dialogs.has(dialog));
    });
  });
});
