'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var LocalMedia = require('./media/localmedia');

/**
 * Construct an {@link IncomingInvite}.
 * @class
 * @classdesc An {@link IncomingInvite} to a {@link Conversation} can be
 * accepted or rejected.
 * <br><br>
 * {@link IncomingInvite}s are returned by {@link Client#event:invite}.
 * @param {IncomingInviteImpl} impl
 * @param {function(ConversationImpl): Conversation} createConversation
 * @property {Conversation.SID} conversationSid
 * @property {?string} from
 * @property {Participant.SID} participantSid
 * @property {status} - one of "pending", "accepting", "accepted", "rejected",
 * "canceled", or "failed"
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#accepting
 * @fires IncomingInvite#canceled
 * @fires IncomingInvite#failed
 * @fires IncomingInvite#pending
 * @fires IncomingInvite#rejected
 */
function IncomingInvite(impl, createConversation) {
  if (!(this instanceof IncomingInvite)) {
    return new IncomingInvite(impl, createConversation);
  }
  EventEmitter.call(this);

  Object.defineProperties(this, {
    _createConversation: {
      value: createConversation
    },
    _impl: {
      value: impl
    },
    conversationSid: {
      enumerable: true,
      value: impl.conversationSid
    },
    from: {
      enumerable: true,
      value: impl.from
    },
    participantSid: {
      enumerable: true,
      value: impl.participantSid
    },
    status: {
      enumerable: true,
      get: function() {
        return impl.state;
      }
    }
  });

  handleImplEvents(this, impl);
}

inherits(IncomingInvite, EventEmitter);

/**
 * Accept.
 * @param {IncomingInvite.AcceptOptions} [options]
 * @returns {Promise<Conversation>}
 */
IncomingInvite.prototype.accept = function accept(options) {
  options = Object.assign({
    shouldStopLocalMedia: options &&
      (options.localMedia || options.localStream)
  }, options);

  var self = this;
  return LocalMedia.getLocalMedia(options).then(
    function getLocalMediaSucceeded(localMedia) {
    return self._impl.accept(localMedia, options).then(
      function acceptSucceeded(conversationImpl) {
      return self._createConversation(conversationImpl, options);
    }, function acceptFailed(error) {
      if (options.shouldStopLocalMedia) {
        localMedia.stop();
      }
      throw error;
    });
  });
};

/**
 * Reject.
 */
IncomingInvite.prototype.reject = function reject() {
  return this._impl.reject();
};

/**
 * The {@link IncomingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#accepted
 */

/**
 * The {@link Client} is attempting to accept the {@link IncomingInvite}.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#accepting
 */

/**
 * The {@link IncomingInvite} was canceled.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#canceled
 */

/**
 * The {@link IncomingInvite} failed.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#failed
 */

/**
 * The {@link IncomingInvite} is pending.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#pending
 */

/**
 * The {@link IncomingInvite} was rejected.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#rejected
 */

/**
 * You may pass these options to {@link IncomingInvite#accept} to
 * override the default behavior.
 * @typedef {object} IncomingInvite.AcceptOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 * servers used by the {@link Client} when connecting to {@link Conversation}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 * ICE transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 * {@link LocalMedia} object when accepting an {@link IncomingInvite}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 * MediaStream when accepting an {@link IncomingInvite}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 * override the parameters passed to <code>getUserMedia</code> when neither
 * <code>localMedia</code> nor <code>localStream</code> are provided
 */

function handleImplEvents(incomingInvite, impl) {
  // Reemit state transition events from the IncomingInviteImpl.
  impl.on('stateChanged', function stateChanged(state) {
    incomingInvite.emit(state, incomingInvite);
  });
}

module.exports = IncomingInvite;
