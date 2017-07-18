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
 * @fires RemoteParticipant#trackSubscribed
 * @fires RemoteParticipant#trackUnsubscribed
 */
function RemoteParticipant(signaling, options) {
  if (!(this instanceof RemoteParticipant)) {
    return new RemoteParticipant(signaling, options);
  }
  Participant.call(this, signaling, options);
  this.once('disconnected', this._removeAllSubscribedTracks.bind(this));
}

inherits(RemoteParticipant, Participant);

RemoteParticipant.prototype.toString = function toString() {
  return '[RemoteParticipant #' + this._instanceId
    + (this.sid ? ': ' + this.sid : '')
    + ']';
};

RemoteParticipant.prototype._addTrack = function _addTrack(remoteTrack) {
  if (!Participant.prototype._addTrack.call(this, remoteTrack)) {
    return null;
  }
  this.emit('trackSubscribed', remoteTrack);
  return remoteTrack;
};

RemoteParticipant.prototype._removeAllSubscribedTracks = function _removeAllSubscribedTracks() {
  var tracks = Array.from(this.tracks.values());
  tracks.forEach(this._removeSubscribedTrack, this);
};

RemoteParticipant.prototype._removeSubscribedTrack = function _removeSubscribedTrack(remoteTrack) {
  var unsubscribedTrack = this.tracks.get(remoteTrack.id) || null;
  if (unsubscribedTrack) {
    unsubscribedTrack._unsubscribe();
    this.emit('trackUnsubscribed', unsubscribedTrack);
  }
  return unsubscribedTrack;
};

RemoteParticipant.prototype._removeTrack = function _removeTrack(remoteTrack) {
  var unsubscribedTrack = this._removeSubscribedTrack(remoteTrack);
  if (unsubscribedTrack) {
    Participant.prototype._removeTrack.call(this, unsubscribedTrack);
  }
  return unsubscribedTrack;
};

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
 * @event RemoteParticipant#trackSubscribed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;
