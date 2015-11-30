'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var constants = require('./util/constants');
var Conversation = require('./conversation');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./signaling/invitetransaction/inviteclienttransaction');
var LocalMedia = require('./media/localmedia');
var util = require('./util');

/**
 * Construct an {@link OutgoingInvite}.
 * @class
 * @classdesc An {@link OutgoingInvite} is a Promise that eventually resolves
 *   to a {@link Conversation} if one or more {@link Participant}s accept the
 *   corresponding {@link IncomingInvite}. An {@link OutgoingInvite} may be
 *   canceled up until a {@link Participant} has accepted it.
 *   <br><br>
 *   {@link OutgoingInvite}s are returned by {@link Client#inviteToConversation}.
 * @extends Promise<Conversation>
 * @param {UserAgent} userAgent - the {@link UserAgent} to perform the invite
 * @param {Array<string>} participants - the {@link Participant} identities to
 *   invite
 * @param {?object} [options]
 * @property {string} status - The status of this {@link OutgoingInvite}, either
 *   "accepted", "rejected", "canceled", or "pending"
 * @property {Array<string>} to - The {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 */
function OutgoingInvite(userAgent, participants, options) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(userAgent, participants, options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options);

  var deferred = util.defer();
  var cancelablePromise = new CancelablePromise(deferred.promise);

  var conversation = new Conversation(options);
  var cookie = util.makeUUID();
  var ict;
  var self = this;
  var status = 'pending';

  Object.defineProperties(this, {
    _cancelablePromise: {
      value: cancelablePromise
    },
    _conversation: {
      value: conversation
    },
    _cookie: {
      value: cookie
    },
    _onReceiveInvite: {
      value: setupConversation
    },
    _options: {
      value: options
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
      }
    },
    status: {
      enumerable: true,
      get: function() {
        return status;
      }
    },
    to: {
      enumerable: true,
      value: participants
    }
  });

  LocalMedia.getLocalMedia(options)
    .then(setLocalMedia)
    .then(inviteParticipants)
    .then(setupConversation, inviteParticipantsFailed);

  function setLocalMedia(localMedia) {
    conversation._localMedia = localMedia;
    options.localMedia = localMedia;
  }

  function inviteParticipants() {
    if (self.status === 'canceled') {
      return null;
    }

    options.cookie = cookie;
    ict = userAgent.invite(participants, options);
    return ict;
  }

  function setupConversation(dialog) {
    if (!dialog || self.status === 'canceled') {
      return;
    }

    conversation._onDialog(dialog);

    self._status = 'accepted';
    self.emit('accepted', self);

    deferred.resolve(conversation);
  }

  function inviteParticipantsFailed(reason) {
    if (reason instanceof InviteClientTransaction && participants.length) {
      return;
    }

    if (['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(reason.name) > -1) {
      deferred.reject(E.MEDIA_ACCESS_DENIED);
      return;
    }

    // If the main InviteClientTransaction times out but we have Participants,
    // then this is a successful multi-invite.
    if (reason.message === 'ignored' && conversation.participants.size) {
      return;
    }

    var error;
    switch (reason.message) {
      case 'Canceled':
      case 'canceled':
        error = E.CONVERSATION_INVITE_CANCELED;
        break;
      case 'rejected':
        error = E.CONVERSATION_INVITE_REJECTED;
        break;
      case 'ignored':
        error = E.CONVERSATION_INVITE_TIMEOUT;
        break;
      case 'failed':
        /* falls through */
      default:
        error = E.CONVERSATION_CREATE_FAILED;
        break;
    }

    deferred.reject(error);
  }

  cancelablePromise.once('canceled', function() {
    self._status = 'canceled';
    self.emit('canceled', self);
    if (ict) {
      ict.cancel();
    }
  });
}

inherits(OutgoingInvite, EventEmitter);

OutgoingInvite.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  if (this.status !== 'pending' && this.status !== 'accepted') {
    inviteServerTransaction.reject();
    return this;
  }

  var conversation = this._conversation;
  inviteServerTransaction.accept(this._options)
    .then(this._onReceiveInvite)
    .catch(function(reason) {
      var error = E.CONVERSATION_INVITE_FAILED.clone(reason.message || reason);
      conversation.emit('participantFailed', error);
    });

  return this;
};

/**
 * Attempt to cancel the {@link OutgoingInvite}.
 * @returns {this}
 */
OutgoingInvite.prototype.cancel = function cancel() {
  this._cancelablePromise.cancel();
  return this;
};

OutgoingInvite.prototype.catch = function _catch() {
  return this._cancelablePromise.catch.apply(this._cancelablePromise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._cancelablePromise.then.apply(this._cancelablePromise, arguments);
};

module.exports = OutgoingInvite;
