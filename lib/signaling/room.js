'use strict';

const DefaultRecordingSignaling = require('./recording');
const StateMachine = require('../statemachine');
const DefaultTimeout = require('../util/timeout');
const { buildLogLevels } = require('../util');
const { DEFAULT_LOG_LEVEL } = require('../util/constants');
const Log = require('../util/log');

const {
  MediaConnectionError,
  MediaDTLSTransportFailedError,
  SignalingConnectionDisconnectedError
} = require('../util/twilio-video-errors');

let nInstances = 0;

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
 * @property {RTCPeerConnectionState} connectionState
 * @property {?Participant.SID} dominantSpeakerSid
 * @property {ParticipantSignaling} localParticipant
 * @property {RTCIceConnectionState} iceConnectionState
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected", "reconnecting", or "disconnected"
 * @property {string} signalingConnectionState - "connected",
 *   "reconnecting", or "disconnected"
 * @emits RoomSignaling#connectionStateChanged
 * @emits RoomSignaling#dominantSpeakerChanged
 * @emits RoomSignaling#iceConnectionStateChanged
 * @emits RoomSignaling#signalingConnectionStateChanged
 */
class RoomSignaling extends StateMachine {
  /**
   * Construct a {@link RoomSignaling}.
   * @param {ParticipantSignaling} localParticipant
   * @param {Room.SID} sid
   * @param {string} name
   * @param {object} options
   */
  constructor(localParticipant, sid, name, options) {
    options = Object.assign({
      logLevel: DEFAULT_LOG_LEVEL,
      RecordingSignaling: DefaultRecordingSignaling,
      Timeout: DefaultTimeout
    }, options);

    const logLevels = buildLogLevels(options.logLevel);

    super('connected', states);

    const RecordingSignaling = options.RecordingSignaling;

    const sessionTimeout = new options.Timeout(() => {
      this._disconnect(this._reconnectingError);
    }, options.sessionTimeout, false);

    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: options.log
          ? options.log.createLog('default', this)
          : new Log('default', this, logLevels, options.loggerName)
      },
      _mediaConnectionIsReconnecting: {
        writable: true,
        value: false
      },
      _options: {
        value: options
      },
      _reconnectingError: {
        value: null,
        writable: true
      },
      _sessionTimeout: {
        value: sessionTimeout
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

    this.on('connectionStateChanged', () => {
      if (this.connectionState === 'failed'
        && !['disconnected', 'failed'].includes(this.iceConnectionState)) {
        this._disconnect(new MediaDTLSTransportFailedError());
      }
    });

    this.on('iceConnectionStateChanged', () => maybeUpdateState(this));
    this.on('signalingConnectionStateChanged', () => maybeUpdateState(this));

    // NOTE(mmalavalli): In case "iceConnectionState" is already failed, update
    // the RoomSignaling state. setTimeout() ensures that the state is updated
    // after RoomV2's constructor is fully executed, thereby making "signalingConnectionState"
    // available here.
    setTimeout(() => maybeUpdateState(this));
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

  toString() {
    return `[RoomSignaling #${this._instanceId}: ${this.localParticipant ? this.localParticipant.sid : 'null'}]`;
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
 * @event RoomSignaling#event:connectionStateChanged
 */

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
 * @event RoomSignaling#event:iceConnectionStateChanged
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
    roomSignaling._sessionTimeout.clear();
    return;
  }

  let newState;

  if (roomSignaling.signalingConnectionState === 'reconnecting') {
    newState = roomSignaling.signalingConnectionState;
  } else if (roomSignaling.iceConnectionState === 'failed') {
    roomSignaling._mediaConnectionIsReconnecting = true;
    newState = 'reconnecting';
  } else if (roomSignaling.iceConnectionState === 'new' || roomSignaling.iceConnectionState === 'checking') {
    newState = roomSignaling._mediaConnectionIsReconnecting ? 'reconnecting' : 'connected';
  } else {
    roomSignaling._mediaConnectionIsReconnecting = false;
    roomSignaling._reconnectingError = null;
    roomSignaling._sessionTimeout.clear();
    newState = 'connected';
  }

  if (newState === roomSignaling.state) {
    return;
  }

  if (newState === 'reconnecting') {
    roomSignaling._reconnectingError = roomSignaling.signalingConnectionState === 'reconnecting'
      ? new SignalingConnectionDisconnectedError()
      : new MediaConnectionError();
    roomSignaling._sessionTimeout.start();
    roomSignaling.preempt(newState, null, [roomSignaling._reconnectingError]);
  } else {
    roomSignaling.preempt(newState);
  }
}

module.exports = RoomSignaling;
