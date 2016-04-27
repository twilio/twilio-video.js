'use strict';

var CancelablePromise = require('../../util/cancelablepromise');
var constants = require('../../util/constants');
var ConversationV1 = require('./conversation');
var E = constants.twilioErrors;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./inviteclienttransaction');
var OutgoingInviteSignaling = require('../outgoinginvite');
var TimeoutPromise = require('../../util/timeoutpromise');
var util = require('../../util');

function OutgoingInviteV1(userAgent, participants, localMedia, options) {
  if (!(this instanceof OutgoingInviteV1)) {
    return new OutgoingInviteV1(userAgent, participants, localMedia, options);
  }

  options = util.withDefaults({
    localMedia: localMedia
  }, options);

  OutgoingInviteSignaling.call(this, participants, null, localMedia, options);

  var deferred = util.defer();
  var timeoutPromise = new TimeoutPromise(deferred.promise);
  var cancelablePromise = new CancelablePromise(timeoutPromise);

  var conversation = null;
  var cookie = util.makeUUID();
  var ict;
  var self = this;

  this.on('stateChanged', function stateChanged(state) {
    self.emit(state, self);
  });

  // TimeoutPromise and CancelablePromise reject with their own errors;
  // instead, reject with TwilioErrors describing the state of the
  // OutgoingInvite.
  cancelablePromise.then(this._deferred.resolve, function cancelablePromiseRejected(reason) {
    if (timeoutPromise.isTimedOut) {
      reason = E.CONVERSATION_INVITE_FAILED;
    } else if (cancelablePromise.isCanceled) {
      reason = E.CONVERSATION_INVITE_CANCELED;
    }
    self._deferred.reject(reason);
  });

  Object.defineProperties(this, {
    _cancelablePromise: {
      value: cancelablePromise
    },
    _conversation: {
      get: function() {
        return conversation;
      },
      set: function(_conversation) {
        conversation = _conversation;
      }
    },
    _cookie: {
      value: cookie
    },
    _onReceiveInvite: {
      value: setupConversation
    },
    _timeoutPromise: {
      value: timeoutPromise
    },
    to: {
      enumerable: true,
      value: participants
    }
  });

  inviteParticipants()
    .then(setupConversation, inviteParticipantsFailed);

  function inviteParticipants() {
    if (self.state !== 'pending' && self.state !== 'accepted') {
      return null;
    }

    options.cookie = cookie;
    ict = userAgent.invite(participants, options);
    return ict;
  }

  function setupConversation(dialog) {
    if (!dialog || self.state !== 'pending' && self.state !== 'accepted') {
      return;
    }

    var sid = dialog.conversationSid;
    var participantSid = dialog.participantSid;
    var conversation = self._conversation  || new ConversationV1(localMedia, participantSid, sid, options);
    self._conversation = conversation;
    conversation._onDialog(dialog);

    if (self.state !== 'accepted') {
      self.preempt('accepted');
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
          if (self.state === 'pending') {
            self.preempt('rejected');
          }
          error = E.CONVERSATION_INVITE_REJECTED;
          break;
        case 'failed':
        default:
          if (self.state === 'pending') {
            self.preempt('failed');
          }
          error = E.CONVERSATION_INVITE_FAILED;
      }

      deferred.reject(error);
      return;
    }

    // If inviteParticipants failed with an Error, if may have been a
    // getUserMedia error; reject accordingly.
    if (reason instanceof Error && ['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(reason.name) > -1) {
      if (self.state === 'pending') {
        self.preempt('failed');
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
    self.preempt('failed');
    if (ict) {
      ict.cancel(true);
    }
  });

  // If the CancelablePromise is canceled, then no Participants have connected
  // to the Conversation, so consider the OutgoingInvite canceled.
  cancelablePromise.once('canceled', function() {
    self.preempt('canceled');
    if (ict) {
      ict.cancel();
    }
  });
}

inherits(OutgoingInviteV1, OutgoingInviteSignaling);

OutgoingInviteV1.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  if (this.state !== 'pending' && this.state !== 'accepted') {
    inviteServerTransaction.reject();
    return this;
  }

  inviteServerTransaction.accept(this._options)
    .then(this._onReceiveInvite)
    .catch(function() {
      // Do nothing. We will receive a participantFailed Conversation event.
    });

  return this;
};

OutgoingInviteV1.prototype.cancel = function cancel() {
  this._cancelablePromise.cancel();
  return this;
};

module.exports = OutgoingInviteV1;
