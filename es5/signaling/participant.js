'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +------------+     +-----------+     +--------------+
    |            |     |           |     |              |
    | connecting |---->| connected |---->| disconnected |
    |            |     |           |     |              |
    +------------+     +-----------+     +--------------+

*/

var states = {
  connecting: ['connected'],
  connected: ['disconnected'],
  disconnected: []
};

/**
 * A {@link Participant} implementation
 * @extends StateMachine
 * @property {?string} identity
 * @property {?Participant.SID} sid
 * @property {string} state - "connecting", "connected", or "disconnected"
 * @property {Map<string, TrackSignaling>} tracks
 * @emits ParticipantSignaling#trackAdded
 * @emits ParticipantSignaling#trackRemoved
 */

var ParticipantSignaling = function (_StateMachine) {
  _inherits(ParticipantSignaling, _StateMachine);

  /**
   * Construct a {@link ParticipantSignaling}.
   */
  function ParticipantSignaling() {
    _classCallCheck(this, ParticipantSignaling);

    var _this = _possibleConstructorReturn(this, (ParticipantSignaling.__proto__ || Object.getPrototypeOf(ParticipantSignaling)).call(this, 'connecting', states));

    Object.defineProperties(_this, {
      _identity: {
        writable: true,
        value: null
      },
      _sid: {
        writable: true,
        value: null
      },
      identity: {
        enumerable: true,
        get: function get() {
          return this._identity;
        }
      },
      sid: {
        enumerable: true,
        get: function get() {
          return this._sid;
        }
      },
      tracks: {
        enumerable: true,
        value: new Map()
      }
    });
    return _this;
  }

  /**
   * Add the {@link TrackSignaling}, MediaStreamTrack, or
   * {@link DataTrackSender} to the {@link ParticipantSignaling}.
   * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
   * @returns {this}
   * @fires ParticipantSignaling#trackAdded
   */


  _createClass(ParticipantSignaling, [{
    key: 'addTrack',
    value: function addTrack(track) {
      this.tracks.set(track.id, track);
      this.emit('trackAdded', track);
      return this;
    }

    /**
     * Disconnect the {@link ParticipantSignaling}.
     * @returns {boolean}
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.state !== 'disconnected') {
        this.preempt('disconnected');
        return true;
      }
      return false;
    }

    /**
     * Remove the {@link TrackSignaling}, MediaStreamTrack, or
     * {@link DataTrackSender} from the {@link ParticipantSignaling}.
     * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
     * @returns {boolean}
     * @fires ParticipantSignaling#trackRemoved
     */

  }, {
    key: 'removeTrack',
    value: function removeTrack(track) {
      var didDelete = this.tracks.delete(track.id);
      if (didDelete) {
        this.emit('trackRemoved', track);
      }
      return didDelete;
    }

    /**
     * Connect the {@link ParticipantSignaling}.
     * @param {Participant.SID} sid
     * @param {string} identity
     * @returns {boolean}
     */

  }, {
    key: 'connect',
    value: function connect(sid, identity) {
      if (this.state === 'connecting') {
        this._sid = sid;
        this._identity = identity;
        this.preempt('connected');
        return true;
      }
      return false;
    }
  }]);

  return ParticipantSignaling;
}(StateMachine);

/**
 * {@link TrackSignaling} was added to the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackAdded
 * @param {TrackSignaling} track
 */

/**
 * {@link TrackSignaling} was removed from the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackRemoved
 * @param {TrackSignaling} track
 */

module.exports = ParticipantSignaling;