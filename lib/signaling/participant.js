'use strict';

var inherits = require('util').inherits;
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
  connecting: [
    'connected'
  ],
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link ParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends StateMachine
 * @property {?string} identity
 * @property {?Participant.SID} sid
 * @property {string} state - "connecting", "connected", or "disconnected"
 * @property {Map<string, TrackSignaling>} tracks
 * @emits ParticipantSignaling#trackAdded
 * @emits ParticipantSignaling#trackRemoved
 */
function ParticipantSignaling() {
  StateMachine.call(this, 'connecting', states);

  Object.defineProperties(this, {
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
      get: function() {
        return this._identity;
      }
    },
    sid: {
      enumerable: true,
      get: function() {
        return this._sid;
      }
    },
    tracks: {
      enumerable: true,
      value: new Map()
    }
  });
}

inherits(ParticipantSignaling, StateMachine);

/**
 * Add the {@link TrackSignaling} to the {@link ParticipantSignaling}.
 * @param {TrackSignaling|MediaStreamTrack} track
 * @returns {this}
 * @fires ParticipantSignaling#trackAdded
 */
ParticipantSignaling.prototype.addTrack = function addTrack(track) {
  this.tracks.set(track.id, track);
  this.emit('trackAdded', track);
  return this;
};

/**
 * Disconnect the {@link ParticipantSignaling}.
 * @returns {boolean}
 */
ParticipantSignaling.prototype.disconnect = function disconnect() {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected');
    return true;
  }
  return false;
};

/**
 * Get the SID on the {@link TrackSignaling} for a given {@link Track} ID.
 * @param {Track.ID} id
 * @returns {Promise<Track.SID>}
 */
ParticipantSignaling.prototype.getTrackSid = function getTrackSid(id) {
  if (!this.tracks.has(id)) {
    return Promise.reject(new Error('A TrackSignaling does not exist for this '
      + 'Track ID'));
  }
  return this.tracks.get(id).getSid();
};

/**
 * Remove the {@link TrackSignaling} from the {@link ParticipantSignaling}.
 * @param {TrackSignaling|MediaStreamTrack} track
 * @returns {boolean}
 * @fires ParticipantSignaling#trackRemoved
 */
ParticipantSignaling.prototype.removeTrack = function removeTrack(track) {
  var didDelete = this.tracks.delete(track.id);
  if (didDelete) {
    this.emit('trackRemoved', track);
  }
  return didDelete;
};

/**
 * Connect the {@link ParticipantSignaling}.
 * @param {Participant.SID} sid
 * @param {string} identity
 * @returns {boolean}
 */
ParticipantSignaling.prototype.connect = function connect(sid, identity) {
  if (this.state === 'connecting') {
    this._sid = sid;
    this._identity = identity;
    this.preempt('connected');
    return true;
  }
  return false;
};

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
