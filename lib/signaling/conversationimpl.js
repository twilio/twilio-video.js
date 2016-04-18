'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
ConversationImpl States
-----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

var states = {
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link ConversationImpl}.
 * @class
 * @classdesc A {@link Conversation} implementation
 * @extends StateMachine
 * @param {LocalMedia} localMedia
 * @param {Participant.SID} participantSid
 * @param {Conversation.SID} conversationSid
 * @param {Signaling} signaling
 * @property {LocalMedia} localMedia
 * @property {Participant.SID} participantSid
 * @property {Conversation.SID} sid
 */
function ConversationImpl(localMedia, participantSid, sid, signaling, options) {
  options = Object.assign({}, options);
  StateMachine.call(this, 'connected', states);
  Object.defineProperties(this, {
    _options: {
      value: options
    },
    _signaling: {
      value: signaling
    },
    localMedia: {
      enumerable: true,
      value: localMedia
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(ConversationImpl, StateMachine);

/**
 * Disconnect.
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
ConversationImpl.prototype.disconnect = function disconnect() {
  this.preempt('disconnected');
};

/**
 * Invite another {@link Participant}.
 * @param {string} identity
 * @returns {Promise}
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
ConversationImpl.prototype.invite = function invite(identity) {
  void identity;
  return Promise.resolve();
};

/**
 * @event ConversationImpl#event:participantConnected
 * @param {ParticipantImpl} participantImpl
 */

/**
 * @event ConversationImpl#event:participantFailed
 * @param {ParticipantImpl} participantImpl
 */

module.exports = ConversationImpl;
