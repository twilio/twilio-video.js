'use strict';

var ConversationImpl = require('./conversationimpl');
var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
IncomingInviteImpl States
-------------------------

               +----------+
               |          |
               | rejected |
          +--->|          |
          |    +----------+
    +---------+         +-----------+    +----------+
    |         |-------->|           |    |          |
    | pending |         | accepting |--->| accepted |
    |         |<--------|           |    |          |
    +---------+         +-----------+    +----------+
        | |    +----------+    | |
        | +--->|          |<---+ |
        |      | canceled |      |
        |      |          |      |
        |      +----------+      |
        |       +--------+       |
        +------>|        |<------+
                | failed |
                |        |
                +--------+

*/

var states = {
  pending: [
    'rejected',
    'accepting',
    'canceled',
    'failed'
  ],
  rejected: [],
  accepting: [
    'accepted',
    'canceled',
    'failed'
  ],
  accepted: [],
  canceled: [],
  failed: []
};

/**
 * Construct an {@link IncomingInviteImpl}.
 * @class
 * @classdesc An {@link IncomingInvite} implementation
 * @extends StateMachine
 * @param {Conversation.SID} conversationSid
 * @param {string} from
 * @param {Participant.SID} participantSid
 * @param {Signaling} signaling
 * @property {Conversation.SID} conversationSid
 * @property {string} from
 * @property {Participant.SID} participantSid
 */
function IncomingInviteImpl(conversationSid, from, participantSid, signaling) {
  StateMachine.call(this, 'pending', states);
  Object.defineProperties(this, {
    _signaling: {
      value: signaling
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    from: {
      enumerable: true,
      value: from
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    }
  });
}

inherits(IncomingInviteImpl, StateMachine);

// NOTE(mroberts): This is a dummy implementation suitable for testing.
IncomingInviteImpl.prototype._accept = function _accept(localMedia, options,
  key) {
  void localMedia;
  void options;
  void key;
  return new ConversationImpl(localMedia, this.participantSid,
    this.conversationSid, this);
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
IncomingInviteImpl.prototype._reject = function _reject() {
  // Do nothing.
};

/**
 * Accept.
 * @param {LocalMedia} localMedia
 * @param {object} options
 * @returns {Promise<ConversationImpl>}
 */
IncomingInviteImpl.prototype.accept = function accept(localMedia, options) {
  var self = this;
  return this.bracket('accept', function transition(key) {
    self.throwIfPreempted(key);
    self.transition('accepting', key);
    return self._accept(localMedia, options, key).then(
      function acceptSucceeded(conversationImpl) {
        self.throwIfPreempted(key);
        self.transition('accepted', key);
        return conversationImpl;
      }, function acceptFailed(error) {
        self.tryTransition('failed', key);
        throw error;
      });
  });
};

/**
 * Reject.
 */
IncomingInviteImpl.prototype.reject = function reject() {
  this.preempt('rejected');
  this._reject();
};

module.exports = IncomingInviteImpl;
