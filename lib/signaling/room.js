'use strict';

var inherits = require('util').inherits;
var OutgoingInviteSignaling = require('./outgoinginvite');
var StateMachine = require('../statemachine');

/*
RoomSignaling States
-----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

var states = {
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link RoomSignaling}.
 * @class
 * @classdesc A {@link Room} implementation
 * @extends StateMachine
 * @param {LocalMedia} localMedia
 * @param {Participant.SID} participantSid
 * @param {Room.SID} roomSid
 * @property {LocalMedia} localMedia
 * @property {Participant.SID} participantSid
 * @property {Room.SID} sid
 * @property {string} state - "connected" or "disconnected"
 */
function RoomSignaling(localMedia, participantSid, sid, options) {
  options = Object.assign({}, options);
  StateMachine.call(this, 'connected', states);
  Object.defineProperties(this, {
    _options: {
      value: options
    },
    localMedia: {
      enumerable: true,
      value: localMedia
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(RoomSignaling, StateMachine);

/**
 * Disconnect.
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
RoomSignaling.prototype.disconnect = function disconnect() {
  this.preempt('disconnected');
};

/**
 * Invite another {@link Participant}.
 * @param {string} identity
 * @returns {OutgoingInviteSignaling}
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
RoomSignaling.prototype.invite = function invite(identity) {
  var outgoingInviteSignaling = new OutgoingInviteSignaling(identity);
  outgoingInviteSignaling.preempt('failed');
  return outgoingInviteSignaling;
};

/**
 * @event RoomSignaling#event:participantConnected
 * @param {ParticipantSignaling} participantSignaling
 */

/**
 * @event RoomSignaling#event:participantFailed
 * @param {ParticipantSignaling} participantSignaling
 */

module.exports = RoomSignaling;
