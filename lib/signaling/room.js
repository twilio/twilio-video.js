'use strict';

const DefaultRecordingSignaling = require('./recording');
const StateMachine = require('../statemachine');

/*
RoomSignaling States
-----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

const states = {
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * A {@link Room} implementation
 * @extends StateMachine
 * @property {ParticipantSignaling} localParticipant
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected" or "disconnected"
 */
class RoomSignaling extends StateMachine {
  /**
   * Construct a {@link RoomSignaling}.
   * @param {ParticipantSignaling} localParticipant
   * @param {Room.SID} sid
   * @param {string} name
   */
  constructor(localParticipant, sid, name, options) {
    options = Object.assign({
      RecordingSignaling: DefaultRecordingSignaling
    }, options);

    super('connected', states);

    const RecordingSignaling = options.RecordingSignaling;

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

  /**
   * Disconnect, possibly with an Error.
   * @private
   * @param {Error} [error]
   * @returns {boolean}
   */
  _disconnect(error) {
    if (this.state === 'connected') {
      this.preempt('disconnected', null, [error]);
      return true;
    }
    return false;
  }

  /**
   * Connect {@link RemoteParticipantSignaling} to the {@link RoomSignaling}.
   * @param {RemoteParticipantSignaling} participant
   * @returns {boolean}
   */
  connectParticipant(participant) {
    const self = this;

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
  }

  /**
   * Disconnect.
   * @returns {boolean}
   */
  disconnect() {
    return this._disconnect();
  }
}

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
