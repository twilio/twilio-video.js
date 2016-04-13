'use strict';

/*
IncomingInvite States
---------------------

               +----------+
               |          |
               | rejected |
          +--->|          |
          |    +----------+
    +---------+         +-----------+    +----------+
    |         |-------->|           |    |          |
    | pending |         | accepting |--->| accepted |
    |         |<--------|           |    |          |
    +---------+         +-----------+    +----------+
        | |    +----------+    | |
        | +--->|          |<---+ |
        |      | canceled |      |
        |      |          |      |
        |      +----------+      |
        |       +--------+       |
        +------>|        |<------+
                | failed |
                |        |
                +--------+

*/

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

var states = {
  pending: [
    'rejected',
    'accepting',
    'canceled',
    'failed'
  ],
  rejected: [],
  accepting: [
    'accepted',
    'canceled',
    'failed'
  ],
  accepted: [],
  canceled: [],
  failed: []
};

/**
 * Construct an {@link IncomingInvite}.
 * @class
 * @classdesc An {@link IncomingInvite} to a {@link Conversation} can be
 * accepted or rejected.
 * <br><br>
 * {@link IncomingInvite}s are returned by {@link Client#event:invite}.
 * @param {Signaling} signaling
 * @param {Conversation.SID} conversationSid
 * @param {?string} from
 * @param {Participant.SID} participantSid
 * @property {Conversation.SID} conversationSid
 * @property {?string} from
 * @property {Participant.SID} participantSid
 * @property {status} - one of "pending", "accepting", "accepted", "rejected",
 * "canceled", or "failed"
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#canceled
 * @fires IncomingInvite#failed
 * @fires IncomingInvite#rejected
 */
function IncomingInvite(conversationSid, from, participantSid, signaling) {
  if (!(this instanceof IncomingInvite)) {
    return new IncomingInvite(conversationSid, from, participantSid, signaling);
  }
  EventEmitter.call(this);

  var self = this;
  var stateMachine = new StateMachine('pending', states);
  stateMachine.on('stateChanged', function stateChanged(state) {
    self.emit(state, self);
  });

  Object.defineProperties(this, {
    _signaling: {
      value: signaling
    },
    _stateMachine: {
      value: stateMachine
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    from: {
      enumerable: true,
      value: from
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    state: {
      get: function() {
        return stateMachine.state;
      }
    },
    // TODO(mroberts): Remove this and make state enumerable.
    status: {
      enumerable: true,
      get: function() {
        return stateMachine.state;
      }
    }
  });
}

inherits(IncomingInvite, EventEmitter);

IncomingInvite.prototype.accept = function accept(options) {
  return this._signaling.accept(this, options);
};

IncomingInvite.prototype.reject = function reject() {
  this._signaling.reject(this);
};

/**
 * The {@link IncomingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#accepted
 */

/**
 * The {@link IncomingInvite} was rejected.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#rejected
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

module.exports = IncomingInvite;
