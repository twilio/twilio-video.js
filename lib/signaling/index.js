/* eslint consistent-return:0 */
'use strict';

var inherits = require('util').inherits;
var OutgoingInviteImpl = require('./outgoinginviteimpl');
var StateMachine = require('../statemachine');

/*
Signaling States
----------------

Any state can transition to "closed" (not shown). "listening" can also
transition to "open".

              +---------+        +--------------------+
              |         |        |                    |
              | opening |        | attemptingToListen |
         +--->|         |    +-->|                    |
         |    +---------+    |   +--------------------+
    +--------+   |   |   +------+    |           |     +-----------+
    |        |<--+   +-->|      |<---+           +---->|           |
    | closed |           | open |<---------------------| listening |
    |        |<--+   +-->|      |<---+           +---->|           |
    +--------+   |   |   +------+    |           |     +-----------+
              +---------+   |  +----------------------+      |
              |         |<--+  |                      |<-----+
              | closing |      | attemptingToUnlisten |
              |         |      |                      |
              +---------+      +----------------------+

*/

var states = {
  closed: [
    'opening'
  ],
  opening: [
    'closed',
    'open'
  ],
  open: [
    'closed',
    'attemptingToListen',
    'closing'
  ],
  closing: [
    'closed',
    'open'
  ],
  attemptingToListen: [
    'closed',
    'open',
    'listening'
  ],
  listening: [
    'closed',
    'open',
    'attemptingToUnlisten'
  ],
  attemptingToUnlisten: [
    'closed',
    'listening',
    'open'
  ]
};

/**
 * Construct {@link Signaling}.
 * @class
 * @extends EventEmitter
 * @property {string} state - one of "closed", "opening", "open",
 * "attemptingToListen", "listening", "attemptingToUnlisten", or "closing"
 */
function Signaling() {
  StateMachine.call(this, 'closed', states);
}

inherits(Signaling, StateMachine);

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._close = function _close(key) {
  this.throwIfPreempted(key);
  this.transition('closing', key);
  this.transition('closed', key);
  return Promise.resolve();
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._connect = function _connect(identities, conversationSid,
  localMedia, options) {
  conversationSid = conversationSid || 'CV00000000000000000000000000000000';
  return new OutgoingInviteImpl(conversationSid, identities, localMedia, this,
    options);
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._listen = function _listen(key) {
  this.throwIfPreempted(key);
  this.transition('attemptingToListen', key);
  this.transition('listening', key);
  return Promise.resolve();
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._open = function _open(key) {
  this.throwIfPreempted(key);
  this.transition('opening', key);
  this.transition('open', key);
  return Promise.resolve();
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._unlisten = function _unlisten(key) {
  this.throwIfPreempted(key);
  this.transition('attemptingToUnlisten', key);
  this.transition('open', key);
  return Promise.resolve();
};

/**
 * Close the {@link Signaling}.
 * @returns {Promise}
 */
Signaling.prototype.close = function close() {
  var self = this;
  return this.bracket('close', function transition(key) {
    switch (self.state) {
      case 'closed':
        return;
      case 'open':
        return self._close(key);
      case 'listening':
        return self._unlisten(key).then(transition.bind(null, key),
          self._close.bind(self, key));
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Connect to a {@link ConversationImpl}.
 * @param {Array<string>} identities
 * @param {?Conversation.SID} conversationSid
 * @param {LocalMedia} localMedia
 * @param {object} options
 * @returns {Promise<ConversationImpl>}
 */
Signaling.prototype.connect = function connect(identities, conversationSid,
  localMedia, options) {
  var self = this;
  return this.bracket('connect', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
      case 'listening':
        // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
        // we just need to ensure the Signaling remains open.
        self.releaseLockCompletely(key);
        return self._connect(identities, conversationSid, localMedia, options);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Start listening for {@link IncomingInviteImpl}s.
 * @returns {Promise}
 */
Signaling.prototype.listen = function listen() {
  var self = this;
  return this.bracket('listen', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
        return self._listen(key);
      case 'listening':
        return;
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Open the {@link Signaling}.
 * @returns {Promise}
 */
Signaling.prototype.open = function open() {
  var self = this;
  return this.bracket('open', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key);
      case 'open':
      case 'listening':
        return;
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Stop listening for {@link IncomingInvite}s.
 * @returns {Promise}
 */
Signaling.prototype.unlisten = function unlisten() {
  var self = this;
  return this.bracket('unlisten', function transition(key) {
    switch (self.state) {
      case 'closed':
      case 'open':
        return;
      case 'listening':
        return self._unlisten(key);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * @event Signaling#event:invite
 * @param {IncomingInviteImpl}
 */

module.exports = Signaling;
