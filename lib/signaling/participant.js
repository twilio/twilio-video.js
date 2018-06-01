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
 * @property {Map<string, TrackSignaling>} tracks
 * @emits ParticipantSignaling#networkQualityLevelsChanged
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
    this.tracks.set(track.id, track);
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
    const didDelete = this.tracks.delete(track.id);
    if (didDelete) {
      this.emit('trackRemoved', track);
    }
    return didDelete;
  }

  /**
   * @param {NetworkQualityLevels} networkQualityLevels
   * @returns {void}
   */
  setNetworkQualityLevels(networkQualityLevels) {
    this._networkQualityLevels = networkQualityLevels;
    this.emit('networkQualityLevelsChanged', networkQualityLevels);
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
 * @event ParticipantSignaling#event:networkQualityLevelsChanged
 * @param {NetworkQualityLevels} networkQualityLevels
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
