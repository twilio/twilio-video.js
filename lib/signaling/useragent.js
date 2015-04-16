'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./invitetransaction/inviteclienttransaction');
var Q = require('q');
var Set = require('es6-set');
var Token = require('../token');
var util = require('../util');

/**
 * Construct a {@link UserAgent}.
 * @class
 * @classdesc {@link UserAgent} is the interface through which the SDK
 *   interoperates with one or more signaling libraries.
 * @param {(string|Token)} token - {@link Token}
 * @param {object} [options]
 * @property {Set<Dialog>} dialogs - the set of {@link Dialog}s (accepted
 *   {@link InviteTransaction}s active on this {@link UserAgent}
 * @property {Array<object>} iceServers - the (STUN/TURN) ICE servers to use
 * @property {Set<InviteClientTransaction>} inviteClientTransactions - the set
 *   of {@link InviteClientTransaction}s active on this {@link UserAgent}
 * @property {Set<InviteServerTransaction>} inviteServerTransactions - the set
 *   of {@link InviteServerTransaction}s active on this {@link UserAgent}
 * @property {boolean} registered - whether or not this {@link UserAgent} is
 *   registered
 * @property {Token} token - the {@link Token}
 * @fires UserAgent#invite
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#unregistered
 */
function UserAgent(token, options) {
  EventEmitter.call(this);

  token = new Token(token);
  options = util.withDefaults(options, {
    'iceServers': [],
    'inviteClientTransactionFactory': InviteClientTransaction
  });

  var registered = false;

  Object.defineProperties(this, {
    '_inviteClientTransactionFactory': {
      value: options['inviteClientTransactionFactory']
    },
    '_registered': {
      set: function(_registered) {
        registered = _registered;
      }
    },
    '_token': {
      set: function(_token) {
        token = _token;
      }
    },
    'dialogs': {
      enumerable: true,
      value: new Set()
    },
    'iceServers': {
      enumerable: true,
      value: options['iceServers']
    },
    'inviteClientTransactions': {
      enumerable: true,
      value: new Set()
    },
    'inviteServerTransactions': {
      enumerable: true,
      value: new Set()
    },
    'registered': {
      enumerable: true,
      get: function() {
        return registered;
      }
    },
    'token': {
      enumerable: true,
      get: function() {
        return token;
      }
    }
  });

  return this;
}

inherits(UserAgent, EventEmitter);

/**
 * Registers this {@link UserAgent} using its {@link Token}.
 * @instance
 * @param {Token} [token] - {@link Token} (defaults to current {@link Token})
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.register = function register(token) {
  token = token ? new Token(token) : this.token;
  return this._register(token).then(
    this._onRegisterSuccess.bind(this, token),
    this._onRegisterFailure.bind(this));
};

UserAgent.prototype._register = function _register(token) {
  var deferred = Q.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onRegisterSuccess = function _onRegisterSuccess(token) {
  this._registered = true;
  this._token = token;
  this.emit('registered', this);
  return this;
};

UserAgent.prototype._onRegisterFailure = function _onRegisterFailure(error) {
  this.emit('registrationFailed', this);
  throw error;
};

/**
 * Unregisters this {@link UserAgent}.
 * @instance
 * @fires UserAgent#unregistered
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.unregister = function unregister() {
  return this._unregister().then(
    this._onUnregisterSuccess.bind(this),
    this._onUnregisterFailure.bind(this));
};

UserAgent.prototype._unregister = function _unregister() {
  var deferred = Q.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onUnregisterSuccess = function _onUnregisterSuccess() {
  this._registered = false;
  this.emit('unregistered', this);
  return this;
};

UserAgent.prototype._onUnregisterFailure = function _onUnregisterFailure(error) {
  throw error;
};

/**
 * @instance
 * @param {string} address
 * @param {?object} [options]
 * @returns {InviteClientTransaction}
 */
UserAgent.prototype.invite = function invite(address, options) {
  var self = this;
  options = util.withDefaults(options, {
    'iceServers': this.iceServers,
    'localStream': null,
    'localStramConstraints': null
  });
  var ict = new this._inviteClientTransactionFactory(this, address, options);
  this.inviteClientTransactions.add(ict);
  ict.then(
    this._onInviteSuccess.bind(this, ict),
    this._onInviteFailure.bind(this, ict));
  return ict;
};

UserAgent.prototype._onInviteSuccess = function _onInviteSuccess(ict, dialog) {
  var self = this;
  this.inviteClientTransactions.delete(ict);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._onInviteFailure = function _onInviteFailure(ict, error) {
  this.inviteClientTransactions.delete(ict);
  throw error;
};

// Subclasses extend UserAgent by passing their own InviteServerTransactions.
UserAgent.prototype._handleInviteServerTransaction = function _handleInviteServerTransaction(ist) {
  var self = this;
  this.inviteServerTransactions.add(ist);
  ist.then(
    this._onAcceptSuccess.bind(this, ist),
    this._onAcceptFailure.bind(this, ist));
  setTimeout(this.emit.bind(this, 'invite', ist));
};

UserAgent.prototype._onAcceptSuccess = function _onAcceptSuccess(ist, dialog) {
  var self = this;
  this.inviteServerTransactions.delete(ist);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._dialogCreated = function _dialogCreated(dialog) {
  var self = this;
  this.dialogs.add(dialog);
  dialog.once('ended', function() {
    self.dialogs.delete(dialog);
  });
  this.emit('dialogCreated', dialog);
  return dialog;
};

UserAgent.prototype._onAcceptFailure = function _onAcceptFailure(ist, error) {
  this.inviteServerTransactions.delete(ist);
  throw error;
};

function logInviteTransactionRemoval(inviteTransaction) {
  var transactionType = inviteTransaction.accept ? 'Server' : 'Client';
  var transactionState;
  switch (true) {
    case inviteTransaction.canceled: transactionState = 'canceled'; break;
    case inviteTransaction.failed:   transactionState = 'failed';   break;
    case inviteTransaction.rejected: transactionState = 'rejected'; break;
  }
}

module.exports = UserAgent;
