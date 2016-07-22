'use strict';

var inherits = require('util').inherits;
var Participant = require('./participant');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Client} in a
 * {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {LocalMedia} localMedia
 */
function LocalParticipant(signaling, localMedia) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localMedia);
  }
  Participant.call(this, signaling, localMedia);
}

inherits(LocalParticipant, Participant);

LocalParticipant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var media = this.media;
  var signaling = this._signaling;

  function localTrackAdded(localTrack) {
    signaling.addTrack(localTrack._signaling);
  }

  function localTrackRemoved(localTrack) {
    signaling.removeTrack(localTrack._signaling);
  }

  media.on('trackAdded', localTrackAdded);
  media.on('trackRemoved', localTrackRemoved);

  media.tracks.forEach(localTrackAdded);

  signaling.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      signaling.removeListener('stateChanged', stateChanged);
      media.removeListener('localTrackAdded', localTrackAdded);
      media.removeListener('localTrackRemoved', localTrackRemoved);
    }
  });
};

module.exports = LocalParticipant;
