'use strict';

var inherits = require('util').inherits;
var Participant = require('./participant');

/**
 * Construct a {@link RemoteParticipant}.
 * @class
 * @classdesc A {@link RemoteParticipant} represents a remote {@link Participant}
 * in a {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.ID, RemoteAudioTrack>} subscribedAudioTracks -
 *    The {@link RemoteParticipant}'s subscribed {@link RemoteAudioTrack}s
 * @property {Map<Track.ID, RemoteTrack>} subscribedTracks -
 *    The {@link RemoteParticipant}'s subscribed {@link RemotTrack}s
 * @property {Map<Track.ID, RemoteVideoTrack>} subscribedVideoTracks -
 *    The {@link RemoteParticipant}'s subscribed {@link RemoteVideoTrack}s
 * @fires RemoteParticipant#trackSubscribed
 * @fires RemoteParticipant#trackUnsubscribed
 */
function RemoteParticipant(signaling, options) {
  if (!(this instanceof RemoteParticipant)) {
    return new RemoteParticipant(signaling, options);
  }
  Participant.call(this, signaling, options);

  Object.defineProperties(this, {
    subscribedAudioTracks: {
      enumerable: true,
      value: new Map()
    },
    subscribedTracks: {
      enumerable: true,
      value: new Map()
    },
    subscribedVideoTracks: {
      enumerable: true,
      value: new Map()
    }
  });
}

inherits(RemoteParticipant, Participant);

RemoteParticipant.prototype.toString = function toString() {
  return '[RemoteParticipant #' + this._instanceId
    + (this.sid ? ': ' + this.sid : '')
    + ']';
};

module.exports = RemoteParticipant;
