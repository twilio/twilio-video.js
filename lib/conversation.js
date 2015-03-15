'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var RemoteEndpoint = require('./remoteendpoint');
var Set = require('./util/set');
var Stream = require('./media/stream');
var Q = require('q');

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents a communication to and from one
 *   or more {@link RemoteEndpoint}s.
 *   <br><br>
 *   You cannot call {@link Conversation}'s constructor directly; instead,
 *   call {@link Endpoint#createConversation}.
 * @param {Array<Dialog>} dialogs - the {@link Dialog}s that define this
 *   {@link Conversation}
 * @property {Set<RemoteEndpoint>} participants - the set of
 *   {@link RemoteEndpoint}s active in this {@link Conversation}
 * @fires Conversation#remoteEndpointJoined
 * @fires Conversation#remoteEndpointLeft
 * @fires Conversation#trackAdded
 * @fires Conversation#trackRemoved
 */
function Conversation(_dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(_dialogs);
  }
  var self = this;
  EventEmitter.call(this);
  var addressToRemoteEndpointMap = {};
  var dialogs = new Set();
  Object.defineProperties(this, {
    '_addressToRemoteEndpointMap': {
      value: addressToRemoteEndpointMap
    },
    '_dialogs': {
      value: dialogs
    },
    'participants': {
      enumerable: true,
      get: function() {
        var participants = new Set();
        for (var address in addressToRemoteEndpointMap) {
          participants.add(addressToRemoteEndpointMap[address]);
        }
        return participants;
      }
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
  var address = dialog.remote;
  var remoteEndpoint = this._addressToRemoteEndpointMap[address]
                     = new RemoteEndpoint(address, [this]);
  this._dialogs.add(dialog);
  setTimeout(function() {
    self.emit('remoteEndpointJoined', remoteEndpoint);
  });
  dialog.once('ended', function() {
    var remoteEndpoint = self._addressToRemoteEndpointMap[address];
    if (!remoteEndpoint) {
      return;
    }
    remoteEndpoint.conversations.delete(self);
    delete self._addressToRemoteEndpointMap[address];
    self._dialogs.delete(dialog);
    self.emit('remoteEndpointLeft', remoteEndpoint);
  });
  return this;
};

/**
 * Get the remote {@link Stream}s associated with this
 *   {@link Conversation}.
 * @instance
 * @param {(RemoteEndpoint|Array<RemoteEndpoint>)} [filter] - zero or more
 *   {@link RemoteEndpoint}s to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getRemoteStreams = function getRemoteStreams(filter) {
  filter = filter
         ? (filter.forEach ? filter : [filter])
         : this.participants;
  var endpoints = new Set();
  filter.forEach(function(endpoint) {
    if (!('_userAgent' in endpoint)) {
      endpoints.add(endpoint);
    }
  });
  var streamSet = new Set();
  var streams = [];
  this._dialogs.forEach(function(dialog) {
    endpoints.forEach(function(endpoint) {
      if (dialog.remote === endpoint.address) {
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
 * @param {(RemoteEndpoint|Array<RemoteEndpoint>)} [filter] - zero or more
 *   {@link RemoteEndpoint}s to filter by
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
