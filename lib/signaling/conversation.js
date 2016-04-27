'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
ConversationSignaling States
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
 * Construct a {@link ConversationSignaling}.
 * @class
 * @classdesc A {@link Conversation} implementation
 * @extends StateMachine
 * @param {LocalMedia} localMedia
 * @param {Participant.SID} participantSid
 * @param {Conversation.SID} conversationSid
 * @property {LocalMedia} localMedia
 * @property {Participant.SID} participantSid
 * @property {Conversation.SID} sid
 */
function ConversationSignaling(localMedia, participantSid, sid, options) {
  options = Object.assign({}, options);
  StateMachine.call(this, 'connected', states);
  Object.defineProperties(this, {
    _options: {
      value: options
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

inherits(ConversationSignaling, StateMachine);

/**
 * Disconnect.
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
ConversationSignaling.prototype.disconnect = function disconnect() {
  this.preempt('disconnected');
};

/**
 * Invite another {@link Participant}.
 * @param {string} identity
 * @returns {Promise}
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
ConversationSignaling.prototype.invite = function invite(identity) {
  void identity;
  return Promise.resolve();
};

/**
 * @event ConversationSignaling#event:participantConnected
 * @param {ParticipantSignaling} participantSignaling
 */

/**
 * @event ConversationSignaling#event:participantFailed
 * @param {ParticipantSignaling} participantSignaling
 */

module.exports = ConversationSignaling;
