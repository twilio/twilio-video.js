'use strict';

const StateMachine = require('../statemachine');
const NetworkQualityStats = require('../stats/networkqualitystats');

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

const states = {
  connecting: [
    'connected'
  ],
  connected: [
    'disconnected',
    'reconnecting'
  ],
  reconnecting: [
    'connected',
    'disconnected'
  ],
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
class ParticipantSignaling extends StateMachine {
  /**
   * Construct a {@link ParticipantSignaling}.
   */
  constructor() {
    super('connecting', states);

    Object.defineProperties(this, {
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
      identity: {
        enumerable: true,
        get() {
          return this._identity;
        }
      },
      sid: {
        enumerable: true,
        get() {
          return this._sid;
        }
      },
      tracks: {
        enumerable: true,
        value: new Map()
      }
    });
  }

  /**
   * Get the current {@link NetworkQualityLevel}, if any.
   * @returns {?NetworkQualityLevel} networkQualityLevel - initially null
   */
  get networkQualityLevel() {
    return this._networkQualityLevel;
  }

  /**
   * Get the current {@link NetworkQualityStats}
   * @returns {?NetworkQualityStats} networkQualityStats - initially null
   */
  get networkQualityStats() {
    return this._networkQualityStats;
  }

  /**
   * Add the {@link TrackSignaling}, MediaStreamTrack, or
   * {@link DataTrackSender} to the {@link ParticipantSignaling}.
   * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
   * @returns {this}
   * @fires ParticipantSignaling#trackAdded
   */
  addTrack(track) {
    this.tracks.set(track.id || track.sid, track);
    this.emit('trackAdded', track);
    return this;
  }

  /**
   * Disconnect the {@link ParticipantSignaling}.
   * @returns {boolean}
   */
  disconnect() {
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
  removeTrack(track) {
    const signaling = this.tracks.get(track.id || track.sid);
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
  setNetworkQualityLevel(networkQualityLevel, networkQualityLevels) {
    if (this._networkQualityLevel !== networkQualityLevel) {
      this._networkQualityLevel = networkQualityLevel;
      this._networkQualityStats = networkQualityLevels
      && (networkQualityLevels.audio || networkQualityLevels.video)
        ? new NetworkQualityStats(networkQualityLevels)
        : null;
      this.emit('networkQualityLevelChanged');
    }
  }

  /**
   * Connect the {@link ParticipantSignaling}.
   * @param {Participant.SID} sid
   * @param {string} identity
   * @returns {boolean}
   */
  connect(sid, identity) {
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
  reconnecting() {
    if (this.state === 'connecting' || this.state === 'connected') {
      this.preempt('reconnecting');
      return true;
    }
    return false;
  }
}

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
