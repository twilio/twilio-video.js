/* eslint consistent-return:0 */
'use strict';

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

var constants = require('../util/constants');
var Conversation = require('../conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var LocalMedia = require('../media/localmedia');
var Log = require('../util/log');
var StateMachine = require('../statemachine');

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
 * @classdesc {@link Signaling} enables connections to {@link Conversation}s.
 * @extends EventEmitter
 * @param {AccessManager} accessManager
 * @param {?object} [options={}]
 * @property {Map<Conversation.SID, Conversation} conversations - a Map of
 * connected {@link Conversation}s
 * @property {Map<Participant.SID, IncomingInvites} incomingInvites - a Map of
 * pending {@link IncomingInvite}s
 * @property {string} state - one of "closed", "opening", "open",
 * "attemptingToListen", "listening", "attemptingToUnlisten", or "closing"
 */
function Signaling(accessManager, options) {
  void accessManager;
  options = options || {};
  EventEmitter.call(this);

  var log = options.log ||
    new Log(options.logLevel || constants.DEFAULT_LOG_LEVEL);

  var conversations = new Map();
  var incomingInvites = new Map();

  var stateMachine = new StateMachine('closed', states);
  stateMachine.on('stateChanged', this.emit.bind(this, 'stateChanged'));

  Object.defineProperties(this, {
    _conversations: {
      value: conversations
    },
    _incomingInvites: {
      value: incomingInvites
    },
    _log: {
      value: log
    },
    _options: {
      value: options
    },
    _stateMachine: {
      value: stateMachine
    },
    incomingInvites: {
      enumerable: true,
      get: function() {
        return new Map(incomingInvites);
      }
    },
    conversations: {
      enumerable: true,
      get: function() {
        return new Map(conversations);
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return stateMachine.state;
      }
    }
  });
}

inherits(Signaling, EventEmitter);

Signaling.prototype._accept = function _accept(incomingInvite, options, key) {
  incomingInvite._stateMachine.throwIfPreempted(key);
  incomingInvite._stateMachine.transition('accepting', key);
  var self = this;
  return LocalMedia.getLocalMedia(options).then(
    function getLocalMediaSucceeded(localMedia) {
    incomingInvite._stateMachine.throwIfPreempted(key);
    var sid = incomingInvite.conversationSid;
    var participantSid = incomingInvite.participantSid;
    return self._createConversation(sid, participantSid, localMedia,
      options).then(function createConversationSucceeded(conversation) {
      incomingInvite._stateMachine.transition('accepted', key);
      return conversation;
    }, function createConversationFailed(error) {
      incomingInvite._stateMachine.tryTransition('failed', key);
      throw error;
    });
  }, function getLocalMediaFailed(error) {
    incomingInvite._stateMachine.transition('pending', key);
    throw error;
  });
};

Signaling.prototype._close = function _close(key) {
  this._stateMachine.throwIfPreempted(key);
  this._stateMachine.transition('closing', key);
  this._stateMachine.transition('closed', key);
  return Promise.resolve();
};

Signaling.prototype._connect = function _connect(conversationSidOrLabel,
  options) {
  void conversationSidOrLabel;
  void options;
  throw new Error('Not implemented');
};

Signaling.prototype._createConversation = function _createConversation(sid,
  participantSid, localMedia, options) {
  var self = this;
  return new Promise(function conversationPromise(resolve) {
    var conversation = new Conversation(sid, participantSid, localMedia, self,
      options);
    self._conversations.set(sid, conversation);
    resolve(conversation);
  });
};

Signaling.prototype._disconnect = function _disconnect(conversation) {
  void conversation;
};

Signaling.prototype._handleIncomingInvite = function _handleIncomingInvite(
  incomingInvite) {
  var self = this;
  this._incomingInvites.set(incomingInvite.participantSid, incomingInvite);
  this.emit('invite', incomingInvite);

  function stateChanged() {
    incomingInvite.removeListener('accepted', stateChanged);
    incomingInvite.removeListener('canceled', stateChanged);
    incomingInvite.removeListener('failed', stateChanged);
    incomingInvite.removeListener('rejected', stateChanged);
    self._incomingInvites.delete(incomingInvite.participantSid);
  }

  incomingInvite.on('accepted', stateChanged);
  incomingInvite.on('canceled', stateChanged);
  incomingInvite.on('failed', stateChanged);
  incomingInvite.on('rejected', stateChanged);
};

Signaling.prototype._listen = function _listen(key) {
  this._stateMachine.throwIfPreempted(key);
  this._stateMachine.transition('attemptingToListen', key);
  this._stateMachine.transition('listening', key);
  return Promise.resolve();
};

Signaling.prototype._open = function _open(key) {
  this._stateMachine.throwIfPreempted(key);
  this._stateMachine.transition('opening', key);
  this._stateMachine.transition('open', key);
  return Promise.resolve();
};

Signaling.prototype._reject = function _reject(incomingInvite) {
  this._incomingInvites.delete(incomingInvite.participantSid);
};

Signaling.prototype._unlisten = function _unlisten(key) {
  this._stateMachine.throwIfPreempted(key);
  this._stateMachine.transition('attemptingToUnlisten', key);
  this._stateMachine.transition('open', key);
  return Promise.resolve();
};

/**
 * Accept an {@link IncomingInvite}.
 * @param {IncomingInvite} incomingInvite
 * @param {object} options
 * @returns {Promise<Conversation>}
 */
Signaling.prototype.accept = function accept(incomingInvite, options) {
  if (incomingInvite.state !== 'pending') {
    return Promise.reject(new Error('Unable to accept; IncomingInvite ' +
      'already in state "' + incomingInvite.state + '"'));
  }
  return incomingInvite._stateMachine.bracket('accept',
    this._accept.bind(this, incomingInvite, options));
};

/**
 * Close the {@link Signaling}. Must be called from state "open".
 * @returns {Promise}
 */
Signaling.prototype.close = function close() {
  var self = this;
  return this._stateMachine.bracket('close', function transition(key) {
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
 * Connect to a {@link Conversation}.
 * @param {Conversation.SID|string} conversationSidOrLabel - the SID or label of
 * the {@link Conversation} to connect to
 * @param {object} options
 * @returns {Promise<Conversation>}
 */
Signaling.prototype.connect = function connect(conversationSidOrLabel,
  options) {
  var self = this;
  return this._stateMachine.bracket('connect', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
      case 'listening':
        // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
        // we just need to ensure the Signaling remains open.
        self._stateMachine.releaseLockCompletely(key);
        return self._connect(conversationSidOrLabel, options);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Disconnect a {@link Conversation}.
 * @param {Conversation} conversation
 */
Signaling.prototype.disconnect = function disconnect(conversation) {
  this._conversations.delete(conversation.sid);
  this._disconnect(conversation);
};

/**
 * Invite a {@link Participant} to a {@link Conversation}.
 * @param {string} identity
 */
Signaling.prototype.invite = function invite(conversation, identity) {
  // TODO(mroberts): ...
  void conversation;
  void identity;
  throw new Error('Not yet implemented');
};

/**
 * Start listening for {@link IncomingInvite}s.
 * @returns {Promise}
 */
Signaling.prototype.listen = function listen() {
  var self = this;
  return this._stateMachine.bracket('listen', function transition(key) {
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
  return this._stateMachine.bracket('open', function transition(key) {
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
 * Reject an {@link IncomingInvite}.
 * @param {IncomingInvite} incomingInvite
 */
Signaling.prototype.reject = function reject(incomingInvite) {
  if (incomingInvite.state !== 'pending') {
    throw new Error('Unable to reject; IncomingInvite alreay in state "' +
      incomingInvite.state + '"');
  }
  incomingInvite._stateMachine.preempt('rejected');
  this._reject(incomingInvite);
};

/**
 * Stop listening for {@link IncomingInvite}s.
 * @returns {Promise}
 */
Signaling.prototype.unlisten = function unlisten() {
  var self = this;
  return this._stateMachine.bracket('unlisten', function transition(key) {
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

module.exports = Signaling;
