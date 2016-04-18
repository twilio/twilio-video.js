'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');
var util = require('../util');

/*
OutgoingInviteImpl States
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
 * Construct an {@link OutgoingInviteImpl}.
 * @class
 * @classdesc An {@link OutgoingInvite} implementation
 * @extends StateMachine
 * @param {Array<string>} identities
 * @param {?Conversation.SID} conversationSid
 * @param {LocalMedia} localMedia
 * @param {Signaling} signaling
 * @param {?object} [options={}]
 * @property {Promise<ConversationImpl>} conversationImpl
 * @property {?Conversation.SID} conversationSid
 * @property {Array<string>} identities
 * @property {LocalMedia} localMedia
 */
function OutgoingInviteImpl(identities, conversationSid, localMedia,
  signaling, options) {
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
    _signaling: {
      value: signaling
    },
    conversationImpl: {
      enumerable: true,
      value: deferred.promise
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

inherits(OutgoingInviteImpl, StateMachine);

/**
 * Cancel.
 */
OutgoingInviteImpl.prototype.cancel = function cancel() {
  this.preempt('canceled');
  this._cancel();
};

module.exports = OutgoingInviteImpl;
