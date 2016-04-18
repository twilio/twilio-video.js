'use strict';

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
 *   {@link OutgoingInvite}s are returned by {@link Client#inviteToConversation}.
 * @extends Promise<Conversation>
 * @param {Array<string>} identities
 * @param {Signaling} signaling
 * @param {function(ConversationImpl): Conversation} createConversation
 * @param {?object} [options={}]
 * @property {string} status - The status of this {@link OutgoingInvite}, either
 *   "accepted", "rejected", "canceled", "failed", or "pending"
 * @property {Array<string>} to - The {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 * @fires OutgoingInvite#accepted
 * @fires OutgoingInvite#canceled
 * @fires OutgoingInvite#failed
 * @fires OutgoingInvite#rejected
 */
function OutgoingInvite(identities, signaling, createConversation, options) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(identities, signaling, createConversation,
      options);
  }
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _createConversation: {
      value: createConversation
    },
    _deferred: {
      value: util.defer()
    },
    _impl: {
      writable: true,
      value: null
    },
    _isCanceled: {
      writable: true,
      value: false
    },
    _isFailed: {
      writable: true,
      value: false
    },
    status: {
      enumerable: true,
      get: function() {
        if (this._isCanceled) {
          return 'canceled';
        } else if (this._isFailed) {
          return 'failed';
        } else if (this._impl) {
          return this._impl.state;
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
  createOutgoingInviteImpl(this, signaling, options);
}

inherits(OutgoingInvite, EventEmitter);

/**
 * Attempt to cancel the {@link OutgoingInvite}.
 * @returns {this}
 */
OutgoingInvite.prototype.cancel = function cancel() {
  if (this._impl) {
    this._impl.cancel();
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

function createOutgoingInviteImpl(outgoingInvite, signaling, options) {
  options = Object.assign({
    shouldStopLocalMedia: !(options &&
      (options.localMedia || options.localStream))
  }, options);

  var localMedia = null;
  LocalMedia.getLocalMedia(options).then(
    function getLocalMediaSucceeded(_localMedia) {
    localMedia = _localMedia;
    if (outgoingInvite.status === 'canceled') {
      return null;
    }

    return signaling.connect(outgoingInvite.to, null, localMedia, options);
  }).then(function connectSucceeded(impl) {
    if (outgoingInvite.status === 'canceled') {
      if (options.shouldStopLocalMedia) {
        localMedia.stop();
      }

      // Try canceling the OutgoingInviteImpl, and
      impl.cancel();

      // Just in case it was already accepted, disconnect the ConversationImpl,
      // should it ever resolve.
      impl.then(function connectSucceeded(conversationImpl) {
        if (outgoingInvite.status === 'canceled') {
          conversationImpl.disconnect();
        }
      });

      return;
    }

    outgoingInvite._impl = impl;
    handleImplEvents(outgoingInvite, impl);
    outgoingInvite._deferred.resolve(impl.conversationImpl.then(
      function outgoingInviteSucceeded(conversationImpl) {
      return outgoingInvite._createConversation(conversationImpl, options);
    }));
  }).catch(function onError(error) {
    if (!outgoingInvite._impl) {
      outgoingInvite._isFailed = true;
      outgoingInvite.emit('failed', outgoingInvite);
      outgoingInvite._deferred.reject(error);
    }
  });
}

function handleImplEvents(outgoingInvite, impl) {
  // Reemit state transition events from the OutgoingInviteImpl.
  impl.on('stateChanged', function stateChanged(state) {
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
