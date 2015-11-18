'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var Conversation = require('./conversation');
var E = require('./util/constants').twilioErrors;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
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
 *   {@link OutgoingInvite}s are returned by {@link Client#createConversation}.
 * @extends Promise<Conversation>
 * @param {UserAgent} userAgent - the {@link UserAgent} to perform the invite
 * @param {Array<string>} participants - the {@link Participant} identities to
 *   invite
 * @param {?object} [options]
 * @property {boolean} isCanceled - whether or not the {@link OutgoingInvite}
 *   was canceled
 * @property {Array<string>} participants - the {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 */
function OutgoingInvite(userAgent, participants, options) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(userAgent, participants, options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options, this._options);

  var deferred = util.defer();
  var cancelablePromise = new CancelablePromise(deferred.promise);
  var conversation = new Conversation(this._options);
  var cookie = util.makeUUID();
  var ict;
  var self = this;

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
    isCanceled: {
      enumerable: true,
      get: function() {
        return cancelablePromise.isCanceled;
      }
    },
    participants: {
      enumerable: true,
      value: participants
    }
  });

  getLocalMedia().catch(getLocalMediaFailed)
    .then(setLocalMedia)
    .then(inviteParticipants)
    .then(setupConversation, inviteParticipantsFailed);

  function getLocalMedia() {
    return options.localMedia
      ? Promise.resolve(options.localMedia)
      : LocalMedia.getLocalMedia(options);
  }

  function getLocalMediaFailed(error) {
    if (['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(error.name) > -1) {
      error = E.MEDIA_ACCESS_DENIED;
    }

    deferred.reject(error);
  }

  function setLocalMedia(localMedia) {
    conversation._localMedia = localMedia;
    options.localMedia = localMedia;
  }

  function inviteParticipants() {
    if (self.isCanceled) {
      throw new Error('Canceled');
    }
    options.cookie = cookie;
    ict = userAgent.invite(participants, options);
    return ict;
  }

  function inviteParticipantsFailed(reason) {
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

  function setupConversation(dialog) {
    conversation._addDialog(dialog);
    self.emit('accepted', self);
    deferred.resolve(conversation);
  }

  cancelablePromise.catch(function() {
    if (self.isCanceled && ict) {
      ict.cancel();
    }
  });
}

inherits(OutgoingInvite, EventEmitter);

/**
 * Attempt to cancel the {@link OutgoingInvite}. This method returns a Promise
 * that resolves on successful cancellation. If cancellation fails, this method
 * rejects with a "Cancellation failed" Error.
 * @returns {Promise}
 */
OutgoingInvite.prototype.cancel = function cancel() {
  return this._cancelablePromise.cancel.apply(this._cancelablePromise, arguments);
};

OutgoingInvite.prototype.catch = function _catch() {
  return this._cancelablePromise.catch.apply(this._cancelablePromise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._cancelablePromise.then.apply(this._cancelablePromise, arguments);
};

module.exports = OutgoingInvite;
