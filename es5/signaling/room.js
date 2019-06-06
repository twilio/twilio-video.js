'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
          |  ^               ^
          |  |               |
          |  |   +--------------+
          |  +---|              |
          |      | reconnecting |
          +----->|              |
                 +--------------+

*/

var states = {
  connected: ['reconnecting', 'disconnected'],
  reconnecting: ['connected', 'disconnected'],
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

var RoomSignaling = function (_StateMachine) {
  _inherits(RoomSignaling, _StateMachine);

  /**
   * Construct a {@link RoomSignaling}.
   * @param {ParticipantSignaling} localParticipant
   * @param {Room.SID} sid
   * @param {string} name
   */
  function RoomSignaling(localParticipant, sid, name, options) {
    _classCallCheck(this, RoomSignaling);

    options = Object.assign({
      RecordingSignaling: DefaultRecordingSignaling
    }, options);

    var _this = _possibleConstructorReturn(this, (RoomSignaling.__proto__ || Object.getPrototypeOf(RoomSignaling)).call(this, 'connected', states));

    var RecordingSignaling = options.RecordingSignaling;

    Object.defineProperties(_this, {
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

    _this.on('mediaConnectionStateChanged', function () {
      return maybeUpdateState(_this);
    });
    _this.on('signalingConnectionStateChanged', function () {
      return maybeUpdateState(_this);
    });
    return _this;
  }

  /**
   * Disconnect, possibly with an Error.
   * @private
   * @param {Error} [error]
   * @returns {boolean}
   */


  _createClass(RoomSignaling, [{
    key: '_disconnect',
    value: function _disconnect(error) {
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

  }, {
    key: 'connectParticipant',
    value: function connectParticipant(participant) {
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
    }

    /**
     * Disconnect.
     * @returns {boolean}
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      return this._disconnect();
    }

    /**
     * Set (or unset) the Dominant Speaker.
     * @param {?Participant.SID} dominantSpeakerSid
     * @returns {void}
     */

  }, {
    key: 'setDominantSpeaker',
    value: function setDominantSpeaker(dominantSpeakerSid) {
      this.dominantSpeakerSid = dominantSpeakerSid;
      this.emit('dominantSpeakerChanged');
    }
  }]);

  return RoomSignaling;
}(StateMachine);

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

  var newState = void 0;

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