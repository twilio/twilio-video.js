'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Map = require('es6-map');
var Set = require('./util/set');
var util = require('./util');

// RemoteEndpoint maintains a map of addresses to RemoteEndpoints (and Endpoints).
var registry = new Map();

/**
 * Constructs a {@link RemoteEndpoint}.
 * @class
 * @classdesc A {@link RemoteEndpoint} is any local or remote {@link Endpoint}
 * participating in zero-or-more {@link Conversation}s. {@link RemoteEndpoint}s are
 * identified by their addresses.
 * <br><br>
 * You should not call {@link RemoteEndpoint}'s constructor directly. Instead,
 * refer to the <code>participants</code> property on {@link Conversation}.
 * @memberof Twilio.Signal
 * @param {string} address - the {@link RemoteEndpoint}'s address
 * @param {Set<Conversation>} [conversations] - the {@link Conversation}s this
 *   {@link RemoteEndpoint} is initially active in
 * @property {string} address - the {@link RemoteEndpoint}'s address
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this {@link
 *   RemoteEndpoint} is active in
 * @property {Map<Conversation, Array<Stream>>} streams - a Map from
 *   {@link Conversation}s to audio, video, or data {@link Stream}s offered by this
 *   {@link RemoteEndpoint}
 */
function RemoteEndpoint(address, conversations) {
  EventEmitter.call(this);

  conversations = conversations || new Set();
  var streams = new Map();
  conversations.forEach(function(conversation) {
    streams.set(conversation, new Set());
  });

  if (!this._uuid) {
    Object.defineProperty(this, '_uuid', {
      value: util.makeUUID()
    });
  }

  if (address) {
    Object.defineProperty(this, 'address', {
      enumerable: true,
      value: address
    });
  }

  Object.defineProperties(this, {
    'conversations': {
      enumerable: true,
      value: conversations
    },
    'streams': {
      enumerable: true,
      value: streams
    }
  });

  if (!this._log) {
    Log.mixin.call(this, this.toString());
  }

  registry.set(address, this);
  return this;
}

inherits(RemoteEndpoint, EventEmitter);

// NOTE(mroberts): The following aren't going into JSDoc until I figure out
// how to mark public/private.

RemoteEndpoint._reset = function _reset() {
  registry.clear();
  return RemoteEndpoint;
};

/*
 * Get an existing {@link RemoteEndpoint} by address.
 * @param {string} address -the {@link RemoteEndpoint} address
 * @returns {?RemoteEndpoint}
 */
RemoteEndpoint._get = function _get(address) {
  return registry.get(address) || null;
};

/*
 * Get an existing {@link RemoteEndpoint} by address, or create it if not present.
 * @param {string} address - the {@link RemoteEndpoint} address
 * @returns {?RemoteEndpoint}
 */
RemoteEndpoint._getOrCreate = function _getOrCreate(address) {
  var participant = RemoteEndpoint._get(address);
  if (!participant) {
    participant = new RemoteEndpoint(address);
    registry.set(address, participant);
  }
  return participant;
};

/*
 * Delete a {@link RemoteEndpoint}, preventing future lookup.
 * @param {RemoteEndpoint} participant
 * @returns {?RemoteEndpoint}
 */
RemoteEndpoint._delete = function _delete(participant) {
  var address = participant.address;
  if (RemoteEndpoint._get(address)) {
    registry.delete(address);
  }
  return participant;
};

RemoteEndpoint.prototype.toString = function toString() {
  return '[RemoteEndpoint ' + this.address + ']';
};

module.exports = RemoteEndpoint;
