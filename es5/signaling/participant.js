'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StateMachine = require('../statemachine');
var NetworkQualityStats = require('../stats/networkqualitystats');

/*
ParticipantSignaling States
----------------------

    +------------+     +-----------+     +--------------+
    |            |     |           |     |              |
    | connecting |---->| connected |---->| disconnected |
    |            |     |           |     |              |
    +------------+     +-----------+     +--------------+
                           | ^                    ^
                           | |  +--------------+  |
                           | |--|              |  |
                           |--->| reconnecting |--|
                                |              |
                                +--------------+
*/

var states = {
  connecting: ['connected'],
  connected: ['disconnected', 'reconnecting'],
  reconnecting: ['connected', 'disconnected'],
  disconnected: []
};

/**
 * A {@link Participant} implementation
 * @extends StateMachine
 * @property {?string} identity
 * @property {?Participant.SID} sid
 * @property {string} state - "connecting", "connected", or "disconnected"
 * @property {Map<Track.ID | Track.SID, TrackSignaling>} tracks
 * @emits ParticipantSignaling#networkQualityLevelChanged
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
      _enqueuedPriorityUpdates: {
        value: new Map()
      },
      _identity: {
        writable: true,
        value: null
      },
      _networkQualityLevel: {
        value: null,
        writable: true
      },
      _networkQualityStats: {
        value: null,
        writable: true
      },
      _sid: {
        writable: true,
        value: null
      },
      _trackPrioritySignaling: {
        value: null,
        writable: true
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
   * Get the current {@link NetworkQualityLevel}, if any.
   * @returns {?NetworkQualityLevel} networkQualityLevel - initially null
   */


  _createClass(ParticipantSignaling, [{
    key: 'addTrack',


    /**
     * Add the {@link TrackSignaling}, MediaStreamTrack, or
     * {@link DataTrackSender} to the {@link ParticipantSignaling}.
     * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
     * @returns {this}
     * @fires ParticipantSignaling#trackAdded
     */
    value: function addTrack(track) {
      this.tracks.set(track.id || track.sid, track);
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
     * @returns {?TrackSignaling}
     * @fires ParticipantSignaling#trackRemoved
     */

  }, {
    key: 'removeTrack',
    value: function removeTrack(track) {
      var signaling = this.tracks.get(track.id || track.sid);
      this.tracks.delete(track.id || track.sid);
      if (signaling) {
        this.emit('trackRemoved', track);
      }
      return signaling || null;
    }

    /**
     * @param {NetworkQualityLevel} networkQualityLevel
     * @param {?NetworkQualityLevels} [networkQualityLevels=null]
     * @returns {void}
     */

  }, {
    key: 'setNetworkQualityLevel',
    value: function setNetworkQualityLevel(networkQualityLevel, networkQualityLevels) {
      if (this._networkQualityLevel !== networkQualityLevel) {
        this._networkQualityLevel = networkQualityLevel;
        this._networkQualityStats = networkQualityLevels && (networkQualityLevels.audio || networkQualityLevels.video) ? new NetworkQualityStats(networkQualityLevels) : null;
        this.emit('networkQualityLevelChanged');
      }
    }

    /**
     * updates the subscriber priority for the given track.
     * @param {Track.SID} trackSid
     * @param {?Track.Priority} priority
     * @returns {void}
     */

  }, {
    key: 'updateSubscriberTrackPriority',
    value: function updateSubscriberTrackPriority(trackSid, priority) {
      // note the most recent priority update for the track.
      this._enqueuedPriorityUpdates.set(trackSid, priority);
      if (this._trackPrioritySignaling) {
        this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority);
      }
    }

    /**
     * Set the {@link TrackPrioritySignaling}.
     * @param {TrackPrioritySignaling} trackPrioritySignaling
     * @returns {this}
     */

  }, {
    key: 'setTrackPrioritySignaling',
    value: function setTrackPrioritySignaling(trackPrioritySignaling) {
      var _this2 = this;

      this._trackPrioritySignaling = trackPrioritySignaling;
      if (trackPrioritySignaling) {
        this._enqueuedPriorityUpdates.forEach(function (priority, trackSid) {
          _this2._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority);
        });
        // NOTE(mpatwardhan)- we intentionally do not clear _enqueuedPriorityUpdates,
        // this cache will be used to re-send the priorities in case of VMS-FailOver.
      }
      return this;
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
      if (this.state === 'connecting' || this.state === 'reconnecting') {
        if (!this._sid) {
          this._sid = sid;
        }
        if (!this._identity) {
          this._identity = identity;
        }
        this.preempt('connected');
        return true;
      }
      return false;
    }

    /**
     * Transition to "reconnecting" state.
     * @returns {boolean}
     */

  }, {
    key: 'reconnecting',
    value: function reconnecting() {
      if (this.state === 'connecting' || this.state === 'connected') {
        this.preempt('reconnecting');
        return true;
      }
      return false;
    }
  }, {
    key: 'networkQualityLevel',
    get: function get() {
      return this._networkQualityLevel;
    }

    /**
     * Get the current {@link NetworkQualityStats}
     * @returns {?NetworkQualityStats} networkQualityStats - initially null
     */

  }, {
    key: 'networkQualityStats',
    get: function get() {
      return this._networkQualityStats;
    }
  }]);

  return ParticipantSignaling;
}(StateMachine);

/**
 * @event ParticipantSignaling#event:networkQualityLevelChanged
 */

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