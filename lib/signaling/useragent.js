'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./invitetransaction/inviteclienttransaction');
var util = require('../util');

/**
 * Construct a {@link UserAgent}.
 * @class
 * @classdesc {@link UserAgent} is the interface through which the SDK
 *   interoperates with one or more signaling libraries.
 * @param {AccessManager} accessManager - an AccessManager
 * @param {object} [options]
 * @property {AccessManager} accessManager - the AccessManager
 * @property {Number} callTimeout - a custom time to wait before hanging up
 *   an outgoing call
 * @property {Set<Dialog>} dialogs - the set of {@link Dialog}s (accepted
 *   {@link InviteTransaction}s active on this {@link UserAgent}
 * @property {Set<InviteClientTransaction>} inviteClientTransactions - the set
 *   of {@link InviteClientTransaction}s active on this {@link UserAgent}
 * @property {Set<InviteServerTransaction>} inviteServerTransactions - the set
 *   of {@link InviteServerTransaction}s active on this {@link UserAgent}
 * @property {boolean} registered - whether or not this {@link UserAgent} is
 *   registered
 * @property {Array<object>} stunServers - the STUN servers to use
 * @property {string} token - the Access Token that the {@link UserAgent}
 *   registered with
 * @property {Array<object>} turnServers - the TURN servers to use
 * @fires UserAgent#invite
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#unregistered
 */
function UserAgent(accessManager, options) {
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    inviteClientTransactionFactory: InviteClientTransaction
  });

  var isRegistered = false;
  var isConnected = false;
  var callTimeout = options && options.callTimeout;
  var token = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _inviteClientTransactionFactory: {
      value: options.inviteClientTransactionFactory
    },
    _isConnected: {
      set: function(_isConnected) {
        isConnected = _isConnected;
      }
    },
    _isRegistered: {
      set: function(_isRegistered) {
        isRegistered = _isRegistered;
      }
    },
    _token: {
      get: function() {
        return token;
      },
      set: function(_token) {
        token = _token;
      }
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    callTimeout: {
      value: callTimeout
    },
    dialogs: {
      enumerable: true,
      value: new Set()
    },
    inviteClientTransactions: {
      enumerable: true,
      value: new Set()
    },
    inviteServerTransactions: {
      enumerable: true,
      value: new Set()
    },
    isConnected: {
      enumerable: true,
      get: function() {
        return isConnected;
      }
    },
    isRegistered: {
      enumerable: true,
      get: function() {
        return isRegistered;
      }
    },
    token: {
      enumerable: true,
      get: function() {
        return token;
      }
    }
  });

  if (!this.stunServers) {
    var stunServers = [];
    /* istanbul ignore next */
    Object.defineProperties(this, {
      _stunServers: {
        set: function(_stunServers) {
          stunServers = _stunServers;
        }
      },
      stunServers: {
        enumerable: true,
        get: function() {
          return stunServers;
        }
      }
    });
  }

  if (!this.turnServers) {
    var turnServers = [];
    /* istanbul ignore next */
    Object.defineProperties(this, {
      _turnServers: {
        set: function(_turnServers) {
          turnServers = _turnServers;
        }
      },
      turnServers: {
        enumerable: true,
        get: function() {
          return turnServers;
        }
      }
    });
  }

  return this;
}

inherits(UserAgent, EventEmitter);

/**
 * Connects this {@link UserAgent}.
 * @fires UserAgent#connected
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.connect = function connect() {
  if (this.isConnected) {
    var deferred = util.defer();
    setTimeout(deferred.resolve.bind(null, this));
    return deferred.promise;
  }

  return this._connect().then(
    this._onConnectSuccess.bind(this),
    this._onConnectFailure.bind(this));
};

UserAgent.prototype._connect = function _connect() {
  var deferred = util.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onConnectSuccess = function _onConnectSuccess() {
  this.emit('connected', this);
  this._isConnected = true;
  return this;
};

UserAgent.prototype._onConnectFailure = function _onConnectFailure(error) {
  throw error;
};

/**
 * Disconnects this {@link UserAgent}.
 * @fires UserAgent#disconnected
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.disconnect = function disconnect() {
  if (!this.isConnected) {
    var deferred = util.defer();
    setTimeout(deferred.resolve.bind(null, this));
    return deferred.promise;
  }

  return this._disconnect().then(
    this._onDisconnectSuccess.bind(this),
    this._onDisconnectFailure.bind(this));
};

UserAgent.prototype._disconnect = function _disconnect() {
  var deferred = util.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onDisconnectSuccess = function _onDisconnectSuccess() {
  this.emit('disconnected', this);
  this._isConnected = false;
  return this;
};

UserAgent.prototype._onDisconnectFailure = function _onDisconnectFailure(error) {
  throw error;
};

/**
 * Registers this {@link UserAgent}.
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.register = function register() {
  if (this.isRegistered && this.accessManager.token === this.token) {
    return Promise.resolve(this);
  }
  return this.connect()
    .then(this._register.bind(this, this.accessManager.token))
    .then(this._onRegisterSuccess.bind(this, this.accessManager.token),
          this._onRegisterFailure.bind(this));
};

UserAgent.prototype._register = function _register() {
  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

UserAgent.prototype._onRegisterSuccess = function _onRegisterSuccess(token) {
  this._isRegistered = true;
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
 * @fires UserAgent#unregistered
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.unregister = function unregister() {
  if (!this.isRegistered) {
    return Promise.resolve(this);
  }
  return this.connect()
    .then(this._unregister.bind(this))
    .then(this._onUnregisterSuccess.bind(this),
          this._onUnregisterFailure.bind(this));
};

UserAgent.prototype._unregister = function _unregister() {
  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

UserAgent.prototype._onUnregisterSuccess = function _onUnregisterSuccess() {
  this._isRegistered = false;
  this.emit('unregistered', this);
  return this;
};

UserAgent.prototype._onUnregisterFailure = function _onUnregisterFailure(error) {
  throw error;
};

/**
 * @param {Array<string>|string} identity
 * @param {?object} [options]
 * @returns {InviteClientTransaction}
 */
UserAgent.prototype.invite = function invite(identity, options) {
  var self = this;

  options = util.extend({
    callTimeout: this.callTimeout,
    stunServers: this.stunServers,
    turnServers: this.turnServers
  }, options);

  var addresses = identity.map ? identity : [identity];
  addresses = addresses.map(function(identity) {
    return 'sip:' + util.makeSIPURI(this.accessManager._tokenPayload.sub, identity);
  }, this);

  var ict = new this._inviteClientTransactionFactory(this, addresses, options);
  this.inviteClientTransactions.add(ict);

  ict.then(
    self._onInviteSuccess.bind(self, ict),
    self._onInviteFailure.bind(self, ict));

  return ict;
};

UserAgent.prototype._onInviteSuccess = function _onInviteSuccess(ict, dialog) {
  this.inviteClientTransactions.delete(ict);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._onInviteFailure = function _onInviteFailure(ict, error) {
  this.inviteClientTransactions.delete(ict);
  throw error;
};

// Subclasses extend UserAgent by passing their own InviteServerTransactions.
UserAgent.prototype._handleInviteServerTransaction = function _handleInviteServerTransaction(ist) {
  this.inviteServerTransactions.add(ist);
  ist.then(
    this._onAcceptSuccess.bind(this, ist),
    this._onAcceptFailure.bind(this, ist));
  setTimeout(this.emit.bind(this, 'invite', ist));
};

UserAgent.prototype._onAcceptSuccess = function _onAcceptSuccess(ist, dialog) {
  this.inviteServerTransactions.delete(ist);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._dialogCreated = function _dialogCreated(dialog) {
  var self = this;
  this.dialogs.add(dialog);

  dialog.once('disconnected', function() {
    self.emit('dialogDisconnected', dialog);
  });

  dialog.once('failed', function() {
    self.dialogs.delete(dialog);
    self.emit('dialogFailed', dialog);
  });

  dialog.once('ended', function() {
    self.dialogs.delete(dialog);
    self.emit('dialogEnded', dialog);
  });

  this.emit('dialogCreated', dialog);
  return dialog;
};

UserAgent.prototype._onAcceptFailure = function _onAcceptFailure(ist) {
  this.inviteServerTransactions.delete(ist);
};

module.exports = UserAgent;
