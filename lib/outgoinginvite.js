'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
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
 * @param {Array<string>} identities
 * @param {function(function(LocalMedia): Promise<OutgoingInvite>): Promise<OutgoingInvite>} getLocalMedia
 * @param {function(LocalMedia): Promise<OutgoingInviteSignaling>} createOutgoingInviteSignaling
 * @param {function(ConversationSignaling): Conversation} createConversation
 * @property {string} status - The status of this {@link OutgoingInvite}, either
 *   "accepted", "rejected", "canceled", "failed", or "pending"
 * @property {Array<string>} to - The {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 * @fires OutgoingInvite#accepted
 * @fires OutgoingInvite#canceled
 * @fires OutgoingInvite#failed
 * @fires OutgoingInvite#rejected
 */
function OutgoingInvite(identities, getLocalMedia, createOutgoingInviteSignaling, createConversation) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(identities, getLocalMedia, createOutgoingInviteSignaling, createConversation);
  }
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _deferred: {
      value: util.defer()
    },
    _isCanceled: {
      writable: true,
      value: false
    },
    _isFailed: {
      writable: true,
      value: false
    },
    _signaling: {
      writable: true,
      value: null
    },
    status: {
      enumerable: true,
      get: function() {
        if (this._isCanceled) {
          return 'canceled';
        } else if (this._isFailed) {
          return 'failed';
        } else if (this._signaling) {
          return this._signaling.state;
        }
        return 'pending';
      }
    },
    to: {
      enumerable: true,
      get: function() {
        return identities.slice();
      }
    }
  });

  var cancelationError = new Error('Canceled');

  function cancel(signaling) {
    if (signaling) {
      // Try canceling the OutgoingInviteSignaling, and
      signaling.cancel();

      // Just in case it was already accepted, disconnect the ConversationSignaling,
      // should it ever resolve.
      signaling.getConversationSignaling().then(function connectSucceeded(conversationSignaling) {
        conversationSignaling.disconnect();
      });
    }

    throw cancelationError;
  }

  var self = this;
  getLocalMedia(function getLocalMediaSucceeded(localMedia) {
    if (self.status === 'canceled') {
      cancel();
    }
    return createOutgoingInviteSignaling(localMedia).then(function outgoingInviteSignalingCreated(signaling) {
      if (self.status === 'canceled') {
        cancel(signaling);
      }
      self._signaling = signaling;
      handleSignalingEvents(self, signaling);
      return signaling.getConversationSignaling();
    });
  }).then(function outgoingInviteSignalingAccepted(conversationSignaling) {
    self._deferred.resolve(createConversation(conversationSignaling));
  }).catch(function onError(error) {
    if (error !== cancelationError) {
      self._isFailed = true;
      if (!self._signaling) {
        self.emit('failed', self);
      }
      self._deferred.reject(error);
    }
  });
}

inherits(OutgoingInvite, EventEmitter);

/**
 * Attempt to cancel the {@link OutgoingInvite}.
 * @returns {this}
 */
OutgoingInvite.prototype.cancel = function cancel() {
  if (this._signaling) {
    this._signaling.cancel();
    return this;
  }
  this._isCanceled = true;
  this.emit('canceled', this);
  this._deferred.reject(new Error('OutgoingInvite canceled'));
  return this;
};

OutgoingInvite.prototype.catch = function _catch() {
  return this._deferred.promise.catch.apply(this._deferred.promise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._deferred.promise.then.apply(this._deferred.promise, arguments);
};

function handleSignalingEvents(outgoingInvite, signaling) {
  // Reemit state transition events from the OutgoingInviteSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    outgoingInvite.emit(state, outgoingInvite);
  });
}

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
