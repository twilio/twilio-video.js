'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');

/**
 * Construct a {@link UserAgent}.
 * @class
 * @classdesc {@link UserAgent} is the interface through which Signal SDK
 *   interoperates with one or more (SIP) signaling libraries.
 * @param {string} address - the address to register
 * @property {string} address - the address to register
 * @property {boolean} registered - whether or not this {@link UserAgent} is
 *   registered
 * @fires UserAgent#registered
 * @fires UserAgent#unregistered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#invite
 * @fires UserAgent#hangup
 */
function UserAgent(address) {
  EventEmitter.call(this);
  var registered = false;
  Object.defineProperties(this, {
    // Private
    _registered: {
      get: function() {
        return registered;
      },
      set: function(_registered) {
        registered = _registered;
      }
    },
    // Public
    address: {
      value: address
    },
    registered: {
      get: function() {
        return registered;
      }
    }
  });
  return this;
}

inherits(UserAgent, EventEmitter);

/**
 * Registers this {@link UserAgent} according to its address.
 * @instance
 * @returns {UserAgent}
 */
UserAgent.prototype.register = function register() {
  var self = this;
  setTimeout(function() {
    self._registered = true;
    self.emit('registered');
  });
  // NOTE(mroberts): Alternatively, we could fail.
  /* setTimeout(function() {
    self._registered = false;
    var reason = new Error();
    self.emit('registrationFailed', reason);
  }); */
  return this;
};

/**
 * Unregisters this {@link UserAgent}.
 * @instance
 * @returns {UserAgent}
 */
UserAgent.prototype.unregister = function unregister() {
  var self = this;
  setTimeout(function() {
    if (self._registered) {
      self._registered = false;
      self.emit('unregistered');
    }
  });
};

/**
 * Invite another {@link Participant} by address.
 * @instance
 * @param {string} address - the address of the {@link Participant} to invite
 * @returns {Promise<Dialog>}
 */
UserAgent.prototype.invite = function invite(address) {
  // TODO(mroberts): ...
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve();
  });
  return deferred.promise;
};

/**
 * Hangup a {@link Dialog}.
 * @instance
 * @param {Dialog} dialog - the dialog to hangup
 * @returns {UserAgent}
 */
UserAgent.prototype.hangup = function hangup(dialog) {
  // TODO(mroberts): ...
  return this;
};

module.exports = UserAgent;
