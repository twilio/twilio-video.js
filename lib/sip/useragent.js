'use strict';

var Dialog = require('./dialog');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Map = require('es6-map');
var Set = require('es6-set');
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
  if (!(this instanceof UserAgent)) {
    return new UserAgent(address);
  }
  EventEmitter.call(this);
  var dialogs = new Set();
  var registered = false;
  Object.defineProperties(this, {
    // Private
    _dialogs: {
      value: dialogs
    },
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
  return Object.freeze(this);
}

inherits(UserAgent, EventEmitter);

/**
 * Registers this {@link UserAgent} according to its address.
 * @instance
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.register = function register() {
  var deferred = Q.defer();
  var self = this;
  setTimeout(function() {
    self._registered = true;
    self.emit('registered', self);
    deferred.resolve(self);
  });
  // NOTE(mroberts): Alternatively, we could fail.
  /* setTimeout(function() {
    self._registered = false;
    var reason = new Error();
    self.emit('registrationFailed', reason);
  }); */
  return deferred.promise;
};

/**
 * Unregisters this {@link UserAgent}.
 * @instance
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.unregister = function unregister() {
  var deferred = Q.defer();
  var self = this;
  setTimeout(function() {
    if (self._registered) {
      self._registered = false;
      self.emit('unregistered', self);
    }
    deferred.resolve(self);
  });
  return deferred.promise;
};

/**
 * Invite another {@link Participant}.
 * @instance
 * @param {Session} session - the {@link Session} under which to record the
 *   resulting {@link Dialog}
 * @param {Participant} participant - the {@link Participant} to invite
 * @returns {Promise<Dialog>}
 */
UserAgent.prototype.invite = function invite(session, participant) {
  var deferred = Q.defer();
  var self = this;
  setTimeout(function() {
    var dialog = new Dialog(session, self, participant);
    self._dialogs.add(dialog);
    deferred.resolve(dialog);
  });
  return deferred.promise;
};

/**
 * Hangup a {@link Dialog}.
 * @instance
 * @param {Dialog} dialog - the {@link Dialog} to hangup
 * @returns {Promise<Dialog>}
**
 * Hangup a {@link Dialog} by {@link Session} and {@link Participant}.
 * @param {Session} session - the {@link Session}
 * @param {Participant} participant - the {@link Participant}
 * @returns {Promise<Dialog>}
 */
UserAgent.prototype.hangup = function hangup() {
  var args = [].slice.call(arguments);
  switch (args.length) {
    case 1:
      return hangupDialog(this, args[0]);
    case 2:
      return hangupBySessionParticipant(this, args[0], args[1]);
  }
};

function hangupDialog(userAgent, dialog) {
  var deferred = Q.defer();
  setTimeout(function() {
    if (dialog.userAgent !== userAgent) {
      return deferred.reject(new Error(
        'UserAgent does not own the Dialog it is attempting to hangup'));
    } else if (!userAgent._dialogs.has(dialog)) {
      return deferred.reject(new Error(
        'Dialog is already hungup'));
    }
    userAgent._dialogs.delete(dialog);
    deferred.resolve(dialog);
  });
  return deferred.promise;
};

function hangupBySessionParticipant(userAgent, session, participant) {
  var matching = null;
  userAgent._dialogs.forEach(function(dialog) {
    if (dialog.session === session && dialog.participant === participant) {
      matching = dialog;
    }
  });
  if (matching) {
    return hangupDialog(userAgent, matching);
  }
  var deferred = Q.defer();
  deferred.reject(new Error('No Dialog found'));
  return deferred.promise;
}

module.exports = UserAgent;
