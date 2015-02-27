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
 * @param {Endpoint} endpoint
 * @property {Endpoint} endpoint
 * @property {boolean} registered - whether or not this {@link UserAgent} is
 *   registered
 * @fires UserAgent#registered
 * @fires UserAgent#unregistered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#invite
 * @fires UserAgent#hangup
 */
function UserAgent(endpoint, options) {
  EventEmitter.call(this);
  var dialogs = new Set();
  var pending = new Set();
  var registered = false;
  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    '_pending': {
      value: pending
    },
    '_registered': {
      get: function() {
        return registered;
      },
      set: function(_registered) {
        registered = _registered;
      }
    },
    'endpoint': {
      value: endpoint
    },
    'registered': {
      get: function() {
        return registered;
      }
    }
  });
  return this;
}

inherits(UserAgent, EventEmitter);

/**
 * Registers this {@link UserAgent} according to its {@link Endpoint}'s
 *   address.
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
    var dialog = new Dialog(self, session, participant);
    self._dialogs.add(dialog);
    // FIXME(mroberts): I think this is a little off (see also #hangup).
    session._joined(dialog.userAgent.endpoint);
    session._joined(participant);
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
      return this._hangupDialog(args[0]);
    case 2:
      return this._hangupBySessionAndParticipant(args[0], args[1]);
  }
};

UserAgent.prototype._hangupDialog = function _hangupDialog(dialog) {
  var userAgent = this;
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
    // FIXME(mroberts): We need to track who actually left. For now, we'll
    // always assume the following.
    var session = dialog.session;
    var participant = dialog.participant;
    session._left(userAgent.endpoint);
    session._left(participant);
    deferred.resolve(dialog);
  });
  return deferred.promise;
};

UserAgent.prototype._hangupBySessionAndParticipant =
  function _hangupBySessionAndParticipant(session, participant)
{
  var matching = null;
  // TODO(mroberts): Improve this
  this._dialogs.forEach(function(dialog) {
    if (dialog.session === session && dialog.participant === participant) {
      matching = dialog;
    }
  });
  if (matching) {
    return this._hangupDialog(matching);
  }
  console.log(session);
  session.participants.forEach(function(participant) {
    console.log('- ' + participant.address);
  });
  console.log(participant);
  console.log(participant.address);
  var deferred = Q.defer();
  deferred.reject(new Error('No Dialog found'));
  return deferred.promise;
}

module.exports = UserAgent;
