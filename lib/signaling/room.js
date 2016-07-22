'use strict';

var inherits = require('util').inherits;
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
 * @param {ParticipantSignaling} localParticipant
 * @param {Room.SID} roomSid
 * @property {ParticipantSignaling} localParticipant
 * @property {Room.SID} sid
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {string} state - "connected" or "disconnected"
 */
function RoomSignaling(localParticipant, sid, options) {
  options = Object.assign({}, options);
  StateMachine.call(this, 'connected', states);
  Object.defineProperties(this, {
    _options: {
      value: options
    },
    localParticipant: {
      enumerable: true,
      value: localParticipant
    },
    participants: {
      enumerable: true,
      value: new Map()
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(RoomSignaling, StateMachine);

/**
 * Connect {@link RemoteParticipantSignaling} to the {@link RoomSignaling}.
 * @param {RemoteParticipantSignaling} participant
 * @returns {this}
 */
RoomSignaling.prototype.connectParticipant = function connectParticipant(participant) {
  var self = this;

  this.participants.set(participant.sid, participant);

  participant.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      participant.removeListener('stateChanged', stateChanged);
      self.participants.delete(participant.sid);
      self.emit('participantDisconnected', participant);
    }
  });

  this.emit('participantConnected', participant);

  return this;
};

/**
 * Disconnect.
 */
// NOTE(mroberts): This is a dummy implementation suitable for testing.
RoomSignaling.prototype.disconnect = function disconnect() {
  this.preempt('disconnected');
};

/**
 * {@link RemoteParticipantSignaling} connected to the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantConnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */

/**
 * {@link RemoteParticipantSignaling} disconnected from the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantDisconnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */

module.exports = RoomSignaling;
