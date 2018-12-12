'use strict';

const StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +------------+     +-----------+     +--------------+
    |            |     |           |     |              |
    | connecting |---->| connected |---->| disconnected |
    |            |     |           |     |              |
    +------------+     +-----------+     +--------------+

*/

const states = {
  connecting: [
    'connected'
  ],
  connected: [
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
      _networkQualityLevels: {
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
   * Get the current {@link NetworkQualityLevels}, if any.
   * @deprecated - the decomposed levels are only used for debugging and will be
   *   removed as soon as we are confident in our implementation
   * @returns {?NetworkQualityLevels} networkQualityLevels - initially null
   */
  get networkQualityLevels() {
    return this._networkQualityLevels;
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
   * @returns {boolean}
   * @fires ParticipantSignaling#trackRemoved
   */
  removeTrack(track) {
    const didDelete = this.tracks.delete(track.id || track.sid);
    if (didDelete) {
      this.emit('trackRemoved', track);
    }
    return didDelete;
  }

  /**
   * @param {NetworkQualityLevel} networkQualityLevel
   * @param {?NetworkQualityLevels} [networkQualityLevels=null] - deprecated;
   *   the decomposed levels are only used for debugging and will be removed as
   *   soon as we are confident in our implementation
   * @returns {void}
   */
  setNetworkQualityLevel(networkQualityLevel, networkQualityLevels) {
    if (networkQualityLevels) {
      this._networkQualityLevels = networkQualityLevels;
    }

    if (this._networkQualityLevel !== networkQualityLevel) {
      this._networkQualityLevel = networkQualityLevel;
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
    if (this.state === 'connecting') {
      this._sid = sid;
      this._identity = identity;
      this.preempt('connected');
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
