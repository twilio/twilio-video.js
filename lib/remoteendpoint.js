'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Set = require('./util/set');

/**
 * Constructs a {@link RemoteEndpoint}.
 * @class
 * @classdesc A {@link RemoteEndpoint} is any local or remote {@link Endpoint}
 *   participating in zero-or-more {@link Conversation}s.
 *   {@link RemoteEndpoint}s are identified by their addresses.
 *   <br><br>
 *   You should not call {@link RemoteEndpoint}'s constructor directly.
 *   Instead, refer to the <code>participants</code> property on
 *   {@link Conversation}.
 * @memberof Twilio.Signal
 * @param {string} address - the {@link RemoteEndpoint}'s address
 * @property {string} address - the {@link RemoteEndpoint}'s address
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this
 *   {@link RemoteEndpoint} is active in
 */
function RemoteEndpoint(address) {
  EventEmitter.call(this);
  if (address) {
    Object.defineProperty(this, 'address', {
      enumerable: true,
      value: address
    });
  }
  var conversations = new Set();
  Object.defineProperties(this, {
    'conversations': {
      enumerable: true,
      value: conversations
    }
  });
  return this;
}

inherits(RemoteEndpoint, EventEmitter);

module.exports = RemoteEndpoint;
