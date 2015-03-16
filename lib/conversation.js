'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Set = require('./util/set');
var Stream = require('./media/stream');
var Q = require('q');

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents a communication to and from one
 *   or more participants.
 *   <br><br>
 *   You cannot call {@link Conversation}'s constructor directly; instead,
 *   call {@link Endpoint#createConversation}.
 * @param {Array<Dialog>} dialogs - the {@link Dialog}s that define this
 *   {@link Conversation}
 * @property {Set<string>} participants - the set of
 *   participants active in this {@link Conversation}
 * @fires Conversation#participantJoined
 * @fires Conversation#participantLeft
 * @fires Conversation#trackAdded
 * @fires Conversation#trackRemoved
 */
function Conversation(_dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(_dialogs);
  }
  var self = this;
  EventEmitter.call(this);
  var dialogs = new Set();
  var participants = new Set();
  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    'participants': {
      enumerable: true,
      value: participants
    }
  });
  _dialogs = _dialogs || [];
  _dialogs.forEach(function(dialog) {
    self._addDialog(dialog);
  });
  return Object.freeze(this);
}

inherits(Conversation, EventEmitter);

Conversation.prototype._addDialog = function _addDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }
  var self = this;
  var participant = dialog.remote;
  this._dialogs.add(dialog);
  this.participants.add(participant);
  setTimeout(function() {
    self.emit('participantJoined', participant);
  });
  dialog.once('ended', function() {
    self._dialogs.delete(dialog);
    self.emit('participantLeft', participant);
  });
  return this;
};

/**
 * Get the remote {@link Stream}s associated with this
 *   {@link Conversation}.
 * @instance
 * @param {(string|Array<string>)} [filter] - zero or more
 *   participants to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getRemoteStreams = function getRemoteStreams(filter) {
  var participants = filter
                   ? (filter.forEach ? filter : [filter])
                   : this.participants;
  var streamSet = new Set();
  var streams = [];
  this._dialogs.forEach(function(dialog) {
    participants.forEach(function(participant) {
      if (dialog.remote === participant) {
        if (!streamSet.has(dialog.remoteStream)) {
          streamSet.add(dialog.remoteStream);
          streams.push(dialog.remoteStream);
        }
      }
    });
  });
  return streams;
};

/**
 * Get the local {@link Stream}s associated with this
 *   {@link Conversation}.
 * @instance
 * @param {(Endpoint|Array<Endpoint>)} [filter] - zero or more
 *   {@link Endpoint}s to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getLocalStreams = function getLocalStreams(filter) {
  filter = filter
         ? (filter.forEach ? filter : [filter])
         : this.participants;
  var endpoints = new Set();
  filter.forEach(function(endpoint) {
    if ('_userAgent' in endpoint) {
      endpoints.add(endpoint);
    }
  });
  var streamSet = new Set();
  var streams = [];
  this._dialogs.forEach(function(dialog) {
    endpoints.forEach(function(endpoint) {
      if (typeof endpoint === 'string') {
        return;
      }
      if (dialog.userAgent === endpoint._userAgent) {
        if (!streamSet.has(dialog.localStream)) {
          streamSet.add(dialog.localStream);
          streams.push(dialog.localStream);
        }
      }
    });
  });
  return streams;
};

Object.freeze(Conversation.prototype);

module.exports = Conversation;
