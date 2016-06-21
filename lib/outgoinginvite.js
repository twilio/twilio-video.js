'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct an {@link OutgoingInvite}.
 * @class
 * @classdesc An {@link OutgoingInvite} to a {@link Participant}
 * will be accepted or rejected.
 * <br><br>
 * {@link OutgoingInvite}s are returned by {@link Room#invite}.
 * @extends {Promise<Participant>}
 * @param {OutgoingInviteSignaling} signaling
 * @param {function(ParticipantSignaling): Participant} createParticipant
 * @property {string} to - the {@link Participant} identity invited
 * @property {string} state - one of "pending", "accepted", "rejected", or
 *   "failed"
 * @fires OutgoingInvite#accepted
 * @fires OutgoingInvite#rejected
 * @fires OutgoingInvite#failed
 */
function OutgoingInvite(signaling, createParticipant) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(signaling);
  }
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _promise: {
      value: signaling.then(createParticipant)
    },
    state: {
      enumerable: true,
      get: function() {
        return signaling.state;
      }
    },
    to: {
      enumerable: true,
      value: signaling.to
    }
  });
  handleSignalingEvents(this, signaling);
}

inherits(OutgoingInvite, EventEmitter);

OutgoingInvite.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

function handleSignalingEvents(outgoingInvite, signaling) {
  // Reemit state transition events from the OutgoingInviteSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    outgoingInvite.emit(state, outgoingInvite);
  });
}

module.exports = OutgoingInvite;
