'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

var states = {
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
 * @property {string} state - "connected" or "disconnected"
 * @property {Map<string, TrackSignaling>} tracks
 * @emits ParticipantSignaling#mediaStreamTrackAdded
 * @emits ParticipantSignaling#trackAdded
 * @emits ParticipantSignaling#trackRemoved
 */
function ParticipantSignaling() {
  StateMachine.call(this, 'connected', states);

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
 * Add a {@link MediaStreamTrack} to the {@link ParticipantSignaling}.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStreamTrack} mediaStream
 * @returns {this}
 */
ParticipantSignaling.prototype.addMediaStreamTrack = function addMediaStreamTrack(mediaStreamTrack, mediaStream) {
  this.emit('mediaStreamTrackAdded', mediaStreamTrack, mediaStream);
  return this;
};

/**
 * Add {@link TrackSignaling} to the {@link ParticipantSignaling}.
 * @param {TrackSignaling} track
 * @returns {this}
 */
ParticipantSignaling.prototype.addTrack = function addTrack(track) {
  this.tracks.set(track.id, track);
  this.emit('trackAdded', track);
  return this;
};

/**
 * Disconnect the {@link ParticipantSignaling}.
 * @returns {this}
 */
ParticipantSignaling.prototype.disconnect = function disconnect() {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected');
  }
  return this;
};

/**
 * Remove {@link TrackSignaling} from the {@link ParticipantSignaling}.
 * @param {TrackSignaling} track
 * @returns {this}
 */
ParticipantSignaling.prototype.removeTrack = function removeTrack(track) {
  this.tracks.delete(track.id);
  this.emit('trackRemoved', track);
  return this;
};

/**
 * Set the {@link ParticipantSignaling}'s SID.
 * @param {Participant.SID} sid
 * @returns {this}
 */
ParticipantSignaling.prototype.setSid = function setSid(sid) {
  this._sid = sid;
  return this;
};

/**
 * Set the {@link ParticipantSignaling}'s identity.
 * @param {string} identity
 * @returns {this}
 */
ParticipantSignaling.prototype.setIdentity = function setIdentity(identity) {
  this._identity = identity;
  return this;
};

/**
 * A {@link MediaStreamTrack} was added to the {@link ParticipantSignaling}.
 * @events ParticipantSignaling#mediaStreamTrackAdded
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
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
