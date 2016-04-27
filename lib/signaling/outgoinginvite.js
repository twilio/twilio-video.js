'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');
var util = require('../util');

/*
OutgoingInviteSignaling States
-------------------------

               +----------+
               |          |
               | rejected |
          +--->|          |
          |    +----------+
    +---------+     +----------+
    |         |     |          |
    | pending |---->| accepted |
    |         |     |          |
    +---------+     +----------+
        | |    +----------+
        | +--->|          |
        |      | canceled |
        |      |          |
        |      +----------+
        |       +--------+
        +------>|        |
                | failed |
                |        |
                +--------+

*/

var states = {
  pending: [
    'rejected',
    'accepted',
    'canceled',
    'failed'
  ],
  rejected: [],
  accepted: [],
  canceled: [],
  failed: []
};

/**
 * Construct an {@link OutgoingInviteSignaling}.
 * @class
 * @classdesc An {@link OutgoingInvite} implementation
 * @extends StateMachine
 * @param {Array<string>} identities
 * @param {?Conversation.SID} conversationSid
 * @param {LocalMedia} localMedia
 * @param {?object} [options={}]
 * @property {?Conversation.SID} conversationSid
 * @property {Array<string>} identities
 * @property {LocalMedia} localMedia
 */
function OutgoingInviteSignaling(identities, conversationSid, localMedia, options) {
  options = Object.assign({}, options);
  var deferred = util.defer();
  StateMachine.call(this, 'pending', states);
  Object.defineProperties(this, {
    _conversationSid: {
      get: function() {
        return conversationSid;
      },
      set: function(_conversationSid) {
        conversationSid = _conversationSid;
      }
    },
    _deferred: {
      value: deferred
    },
    _options: {
      value: options
    },
    conversationSid: {
      enumerable: true,
      get: function() {
        return conversationSid;
      }
    },
    identities: {
      enumerable: true,
      get: function() {
        return identities.slice();
      }
    },
    localMedia: {
      enumerable: true,
      value: localMedia
    }
  });
}

inherits(OutgoingInviteSignaling, StateMachine);

/**
 * Cancel.
 */
OutgoingInviteSignaling.prototype.cancel = function cancel() {
  this.preempt('canceled');
  this._cancel();
};

/**
 * Get the {@link ConversationSignaling}.
 * @returns {Promise<ConversationSignaling>}
 */
OutgoingInviteSignaling.prototype.getConversationSignaling = function getConversationSignaling() {
  return this._deferred.promise;
};

module.exports = OutgoingInviteSignaling;
