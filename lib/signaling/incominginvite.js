'use strict';

var RoomSignaling = require('./room');
var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
IncomingInviteSignaling States
-------------------------

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
 * Construct an {@link IncomingInviteSignaling}.
 * @class
 * @classdesc An {@link IncomingInvite} implementation
 * @extends StateMachine
 * @param {Room.SID} roomSid
 * @param {string} from
 * @param {Participant.SID} participantSid
 * @param {?object} [options={}]
 * @property {Room.SID} roomSid
 * @property {string} from
 * @property {Participant.SID} participantSid
 */
function IncomingInviteSignaling(roomSid, from, participantSid, options) {
  options = Object.assign({}, options);
  StateMachine.call(this, 'pending', states);
  Object.defineProperties(this, {
    _options: {
      value: options
    },
    roomSid: {
      enumerable: true,
      value: roomSid
    },
    from: {
      enumerable: true,
      value: from
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    }
  });
}

inherits(IncomingInviteSignaling, StateMachine);

// NOTE(mroberts): This is a dummy implementation suitable for testing.
IncomingInviteSignaling.prototype._accept = function _accept(localMedia, options,
  key) {
  void key;
  options = Object.assign({}, this._options, options);
  return new RoomSignaling(localMedia, this.participantSid, this.roomSid, options);
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
IncomingInviteSignaling.prototype._reject = function _reject() {
  // Do nothing.
};

/**
 * Accept.
 * @param {LocalMedia} localMedia
 * @param {object} options
 * @returns {Promise<RoomSignaling>}
 */
IncomingInviteSignaling.prototype.accept = function accept(localMedia, options) {
  var self = this;
  return this.bracket('accept', function transition(key) {
    self.transition('accepting', key);
    return self._accept(localMedia, options, key).then(
      function acceptSucceeded(roomSignaling) {
        self.transition('accepted', key);
        return roomSignaling;
      }, function acceptFailed(error) {
        self.tryTransition('failed', key);
        throw error;
      });
  });
};

/**
 * Reject.
 */
IncomingInviteSignaling.prototype.reject = function reject() {
  this.preempt('rejected');
  this._reject();
};

module.exports = IncomingInviteSignaling;
