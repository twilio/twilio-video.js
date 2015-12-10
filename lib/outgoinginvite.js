'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var constants = require('./util/constants');
var Conversation = require('./conversation');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./signaling/invitetransaction/inviteclienttransaction');
var LocalMedia = require('./media/localmedia');
var TimeoutPromise = require('./util/timeoutpromise');
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
 *   "accepted", "rejected", "canceled", "failed", or "pending"
 * @property {Array<string>} to - The {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 * @fires OutgoingInvite#accepted
 * @fires OutgoingInvite#canceled
 * @fires OutgoingInvite#failed
 * @fires OutgoingInvite#rejected
 */
function OutgoingInvite(userAgent, participants, options) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(userAgent, participants, options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options);

  var deferred = util.defer();
  var timeoutPromise = new TimeoutPromise(deferred.promise);
  var cancelablePromise = new CancelablePromise(timeoutPromise);

  var shouldStopLocalMediaOnFailure = false;

  var conversation = new Conversation(options);
  var cookie = util.makeUUID();
  var ict;
  var localMedia = null;
  var self = this;
  var status = 'pending';

  // TimeoutPromise and CancelablePromise reject with their own errors;
  // instead, reject with TwilioErrors describing the state of the
  // OutgoingInvite.
  //
  // Also, stop any LocalMedia acquired (otherwise, the user will never get a
  // handle to it and cannot stop it themselves).
  var promise = cancelablePromise.catch(function cancelablePromiseRejected(reason) {
    if (shouldStopLocalMediaOnFailure && localMedia) {
      localMedia.stop();
    }
    if (timeoutPromise.isTimedOut) {
      reason = E.CONVERSATION_INVITE_FAILED;
    } else if (cancelablePromise.isCanceled) {
      reason = E.CONVERSATION_INVITE_CANCELED;
    }
    throw reason;
  });

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
    _localMedia: {
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _onReceiveInvite: {
      value: setupConversation
    },
    _options: {
      value: options
    },
    _promise: {
      value: promise
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
      }
    },
    _timeoutPromise: {
      value: timeoutPromise
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

  getLocalMedia()
    .then(setLocalMedia)
    .then(inviteParticipants)
    .then(setupConversation, inviteParticipantsFailed);

  function getLocalMedia() {
    if (!options.localMedia && !options.localStream) {
      shouldStopLocalMediaOnFailure = true;
    }
    return LocalMedia.getLocalMedia(options);
  }

  function setLocalMedia(_localMedia) {
    localMedia = _localMedia;
    conversation._localMedia = localMedia;
    conversation._shouldStopLocalMediaOnDisconnect = shouldStopLocalMediaOnFailure;
    options.localMedia = localMedia;
    timeoutPromise.start(constants.DEFAULT_CALL_TIMEOUT);
  }

  function inviteParticipants() {
    if (self.status !== 'pending' && self.status !== 'accepted') {
      return null;
    }

    options.cookie = cookie;
    ict = userAgent.invite(participants, options);
    return ict;
  }

  function setupConversation(dialog) {
    if (!dialog || self.status !== 'pending' && self.status !== 'accepted') {
      return;
    }

    conversation._onDialog(dialog);

    if (self.status !== 'accepted') {
      self._status = 'accepted';
      self.emit('accepted', self);
    }

    deferred.resolve(conversation);
  }

  function inviteParticipantsFailed(reason) {
    // If inviteParticipants failed with the InviteClientTransaction, but this
    // OutgoingInvite was to more than one Participant, then do not reject
    // immediately; instead, continue waiting for an InviteServerTransaction.
    //
    // If no InviteServerTransaction is received, the TimeoutPromise will
    // time out. Truly, something else may have happened: the other
    // Participant(s) may have rejected, a server error may have occurred,
    // etc.; however, the best we can do for now is raise "failed".
    if (reason instanceof InviteClientTransaction) {
      if (participants.length > 1) {
        return;
      }

      var error;
      switch (reason.state) {
        case 'canceled':
          error = E.CONVERSATION_INVITE_CANCELED;
          break;
        case 'rejected':
          if (self.status === 'pending') {
            self._status = 'rejected';
            self.emit('rejected', self);
          }
          error = E.CONVERSATION_INVITE_REJECTED;
          break;
        case 'failed':
        default:
          if (self.status === 'pending') {
            self._status = 'failed';
            self.emit('failed', self);
          }
          error = E.CONVERSATION_INVITE_FAILED;
      }

      deferred.reject(error);
      return;
    }

    // If inviteParticipants failed with an Error, if may have been a
    // getUserMedia error; reject accordingly.
    if (reason instanceof Error && ['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(reason.name) > -1) {
      if (self.status === 'pending') {
        self._status = 'failed';
        self.emit('failed', self);
      }
      deferred.reject(E.MEDIA_ACCESS_DENIED);
      return;
    }

    deferred.reject(reason);
  }

  // If the TimeoutPromise times out, then no Participants have connected to
  // the Conversation within the time allotted for the OutgoingInvite, so
  // consider the OutgoingInvite failed.
  timeoutPromise.once('timedOut', function() {
    self._status = 'failed';
    self.emit('failed', self);
    if (ict) {
      ict.cancel(true);
    }
  });

  // If the CancelablePromise is canceled, then no Participants have connected
  // to the Conversation, so consider the OutgoingInvite canceled.
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
  return this._promise.catch.apply(this._promise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link OutgoingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#accepted
 */

/**
 * The {@link OutgoingInvite} was rejected.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#rejected
 */

/**
 * The {@link OutgoingInvite} was canceled.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#canceled
 */

/**
 * The {@link OutgoingInvite} failed.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#failed
 */

module.exports = OutgoingInvite;
