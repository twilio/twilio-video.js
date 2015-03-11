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
function Conversation(dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(dialogs);
  }
  var self = this;
  EventEmitter.call(this);
  dialogs = dialogs || [];
  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    'participants': {
      enumerable: true,
      get: function() {
        return new Set();
      }
    }
  });
  return Object.freeze(this);
}

inherits(Conversation, EventEmitter);

/**
 * Get the remote {@link Stream}s associated with this
 *   {@link Conversation}.
 * @instance
 * @param {(string|RemoteEndpoint)} [filter] - a {@link RemoteEndpoint} or
 *   {@link RemoteEndpoint} address to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getRemoteStreams = function getRemoteStreams(filter) {
  throw new Error('Not implemented');
};

/**
 * Get the local {@link Stream}s associated with this
 *   {@link Conversation}.
 * @instance
 * @param {(string|Endpoint)} [filter] - an {@link Endpoint} or
 *   {@link Endpoint} address to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getLocalStreams = function getLocalStreams(filter) {
  throw new Error('Not implemented');
};

Object.freeze(Conversation.prototype);

module.exports = Conversation;
