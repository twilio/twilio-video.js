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
 * @param {?(string|Conversation.SID)} labelOrSid
 * @param {LocalMedia} localMedia
 * @param {?object} [options={}]
 * @property {?Conversation.SID} conversationSid
 * @property {?string} label
 * @property {?(string|Conversation.SID)} labelOrSid
 * @property {Array<string>} identities
 * @property {LocalMedia} localMedia
 */
function OutgoingInviteSignaling(identities, labelOrSid, localMedia, options) {
  options = Object.assign({}, options);
  var conversationSid = null;
  var deferred = util.defer();
  var label = null;
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
    _label: {
      get: function() {
        return label;
      },
      set: function(_label) {
        label = _label;
      }
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
    label: {
      enumerable: true,
      get: function() {
        return label;
      }
    },
    labelOrSid: {
      enumerable: true,
      value: labelOrSid
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
