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
 * @classdesc {@link UserAgent} is the interface through which Signal SDK
 *   interoperates with one or more signaling libraries.
 * @param {(Token|string)} token - {@link Token} or {@link Token} string
 * @property {Set<Dialog>} dialogs - the set of {@link Dialog}s (accepted
 *   {@link InviteTransaction}s active on this {@link UserAgent}
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
  token = typeof token === 'string' ? new Token(token) : token;
  options = util.withDefaults(options, {
    'inviteClientTransactionFactory': InviteClientTransaction
  });
  EventEmitter.call(this);
  var dialogs = new Set();
  var inviteServerTransactions = new Set();
  var inviteClientTransactions = new Set();
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
      value: dialogs
    },
    'inviteClientTransactions': {
      enumerable: true,
      value: inviteClientTransactions
    },
    'inviteServerTransactions': {
      enumerable: true,
      value: inviteServerTransactions
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
 * @param {(Token|string)} [token] - {@link Token} or {@link Token} string
 *   (defaults to current {@link Token})
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.register = function register(token) {
  if (token) {
    token = typeof token === 'string' ? new Token(token) : token;
  }
  var self = this;
  return this._register(token || self._token).then(function() {
    self._registered = true;
    self._token = token || self.token;
    // setTimeout(function() {
      self.emit('registered', self);
    // });
    return self;
  }, function(error) {
    // setTimeout(function() {
      self.emit('registrationFailed', error);
    // });
    throw error;
  });
};

UserAgent.prototype._register = function _register(token) {
  var self = this;
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve();
  });
  return deferred.promise;
};

/**
 * Unregisters this {@link UserAgent}.
 * @instance
 * @fires UserAgent#unregistered
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.unregister = function unregister() {
  var self = this;
  return this._unregister().then(function() {
    self._registered = false;
    // setTimeout(function() {
      self.emit('unregistered', self);
    // });
    return self;
  }, function(error) {
    // setTimeout(function() {
      self.emit('error', error);
    // });
    throw error;
  });
};

UserAgent.prototype._unregister = function _unregister() {
  var self = this;
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve();
  });
  return deferred.promise;
};

/**
 * @instance
 * @param {string} address
 * @param {?object} [options]
 * @returns {InviteClientTransaction}
 */
UserAgent.prototype.invite = function invite(address, options) {
  var self = this;
  var to = address;
  var inviteClientTransaction = new this._inviteClientTransactionFactory(this, to, options);
  this.inviteClientTransactions.add(inviteClientTransaction);
  inviteClientTransaction.then(function(dialog) {
    self.inviteClientTransactions.delete(inviteClientTransaction);
    self.dialogs.add(dialog);
    dialog.once('ended', function() {
      self.dialogs.delete(dialog);
    });
    return inviteClientTransaction;
  }, function(reason) {
    logInviteTransactionRemoval(inviteClientTransaction);
    self.inviteClientTransactions.delete(inviteClientTransaction);
    throw reason;
  });
  return inviteClientTransaction;
};

// Subclasses extend UserAgent by passing their own InviteServerTransactions.
UserAgent.prototype._handleInviteServerTransaction = 
  function handleInviteServerTransaction(inviteServerTransaction)
{
  var self = this;
  this.inviteServerTransactions.add(inviteServerTransaction);
  inviteServerTransaction.then(function(dialog) {
    self.inviteServerTransactions.delete(inviteServerTransaction);
    self.dialogs.add(dialog);
    dialog.once('ended', function() {
      self.dialogs.delete(dialog);
    });
  }, function(reason) {
    logInviteTransactionRemoval(inviteServerTransaction);
    self.inviteServerTransactions.delete(inviteServerTransaction);
  });
  setTimeout(function() {
    self.emit('invite', inviteServerTransaction);
  });
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
