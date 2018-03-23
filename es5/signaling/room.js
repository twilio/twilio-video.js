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

*/

var states = {
  connected: ['disconnected'],
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
  }]);

  return RoomSignaling;
}(StateMachine);

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