'use strict';

var inherits = require('util').inherits;
var DefaultRecordingSignaling = require('./recording');
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
 * @param {Room.SID} sid
 * @param {string} name
 * @property {ParticipantSignaling} localParticipant
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected" or "disconnected"
 */
function RoomSignaling(localParticipant, sid, name, options) {
  options = Object.assign({
    RecordingSignaling: DefaultRecordingSignaling
  }, options);

  StateMachine.call(this, 'connected', states);

  var RecordingSignaling = options.RecordingSignaling;

  Object.defineProperties(this, {
    _options: {
      value: options
    },
    localParticipant: {
      enumerable: true,
      value: localParticipant
    },
    name: {
      enumerable: true,
      value: name
    },
    participants: {
      enumerable: true,
      value: new Map()
    },
    recording: {
      enumerable: true,
      value: new RecordingSignaling()
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(RoomSignaling, StateMachine);

/**
 * Disconnect, possibly with an Error.
 * @param {Error} [error]
 * @returns {boolean}
 */
RoomSignaling.prototype._disconnect = function _disconnect(error) {
  if (this.state === 'connected') {
    this.preempt('disconnected', null, [error]);
    return true;
  }
  return false;
};

/**
 * Connect {@link RemoteParticipantSignaling} to the {@link RoomSignaling}.
 * @param {RemoteParticipantSignaling} participant
 * @returns {boolean}
 */
RoomSignaling.prototype.connectParticipant = function connectParticipant(participant) {
  var self = this;

  if (participant.state === 'disconnected') {
    return false;
  }

  if (this.participants.has(participant.sid)) {
    return false;
  }

  this.participants.set(participant.sid, participant);

  participant.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      participant.removeListener('stateChanged', stateChanged);
      self.participants.delete(participant.sid);
      self.emit('participantDisconnected', participant);
    }
  });

  this.emit('participantConnected', participant);

  return true;
};

/**
 * Disconnect.
 * @returns {boolean}
 */
RoomSignaling.prototype.disconnect = function disconnect() {
  return this._disconnect();
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
