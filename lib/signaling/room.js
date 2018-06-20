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
          |  ^               ^
          |  |               |
          |  |   +--------------+
          |  +---|              |
          |      | reconnecting |
          +----->|              |
                 +--------------+

*/

const states = {
  connected: [
    'reconnecting',
    'disconnected'
  ],
  reconnecting: [
    'connected',
    'disconnected'
  ],
  disconnected: []
};

/**
 * A {@link Room} implementation
 * @extends StateMachine
 * @property {?Participant.SID} dominantSpeakerSid
 * @property {ParticipantSignaling} localParticipant
 * @property {RTCIceConnectionState} mediaConnectionState
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected", "reconnecting", or "disconnected"
 * @property {string} signalingConnectionState - "connected",
 *   "reconnecting", or "disconnected"
 * @emits RoomSignaling#mediaConnectionStateChanged
 * @emits RoomSignaling#signalingConnectionStateChanged
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
      _mediaConnectionIsReconnecting: {
        writable: true,
        value: false
      },
      _options: {
        value: options
      },
      dominantSpeakerSid: {
        enumerable: true,
        value: null,
        writable: true
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

    this.on('mediaConnectionStateChanged', () => maybeUpdateState(this));
    this.on('signalingConnectionStateChanged', () => maybeUpdateState(this));
  }

  /**
   * Disconnect, possibly with an Error.
   * @private
   * @param {Error} [error]
   * @returns {boolean}
   */
  _disconnect(error) {
    if (this.state !== 'disconnected') {
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

  /**
   * Set (or unset) the Dominant Speaker.
   * @param {?Participant.SID} dominantSpeakerSid
   * @returns {void}
   */
  setDominantSpeaker(dominantSpeakerSid) {
    this.dominantSpeakerSid = dominantSpeakerSid;
    this.emit('dominantSpeakerChanged');
  }
}

/**
 * @event RoomSignaling#event:dominantSpeakerChanged
 */

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

/**
 * @event RoomSignaling#event:mediaConnectionStateChanged
 */

/**
 * @event RoomSignaling#event:signalingConnectionStateChanged
 */

/**
 * Maybe update the {@link RoomSignaling} state.
 * @param {RoomSignaling} roomSignaling
 */
function maybeUpdateState(roomSignaling) {
  if (roomSignaling.state === 'disconnected' || roomSignaling.signalingConnectionState === 'disconnected') {
    return;
  }

  let newState;

  if (roomSignaling.signalingConnectionState === 'reconnecting') {
    newState = roomSignaling.signalingConnectionState;
  } else if (roomSignaling.mediaConnectionState === 'failed') {
    roomSignaling._mediaConnectionIsReconnecting = true;
    newState = 'reconnecting';
  } else if (roomSignaling.mediaConnectionState === 'new' || roomSignaling.mediaConnectionState === 'checking') {
    newState = roomSignaling._mediaConnectionIsReconnecting ? 'reconnecting' : 'connected';
  } else {
    roomSignaling._mediaConnectionIsReconnecting = false;
    newState = 'connected';
  }

  if (newState === roomSignaling.state) {
    return;
  }

  roomSignaling.preempt(newState);
}

module.exports = RoomSignaling;
