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
 * @param {Object} options
 * @property {LocalMedia} media
 */
function LocalParticipant(signaling, localMedia, options) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localMedia, options);
  }
  Participant.call(this, signaling, localMedia, options);
}

inherits(LocalParticipant, Participant);

LocalParticipant.prototype.toString = function toString() {
  return '[LocalParticipant #' + this._instanceId
    + (this.sid ? ': ' + this.sid : '')
    + ']';
};

LocalParticipant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var log = this._log;

  if (this.state === 'disconnected') {
    return;
  }

  var media = this.media;
  var signaling = this._signaling;

  function localTrackAdded(localTrack) {
    signaling.addTrack(localTrack._signaling);
    log.info('Added a new ' + localTrack.kind + ' LocalTrack:', localTrack.id);
    log.debug('LocalTrack:', localTrack);
  }

  function localTrackRemoved(localTrack) {
    signaling.removeTrack(localTrack._signaling);
    log.info('Removed an existing ' + localTrack.kind + ' LocalTrack:', localTrack.id);
    log.debug('LocalTrack:', localTrack);
  }

  media.on('trackAdded', localTrackAdded);
  media.on('trackRemoved', localTrackRemoved);

  media.tracks.forEach(localTrackAdded);

  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('LocalParticipant state changed:', state);
    if (state === 'disconnected') {
      log.info('LocalParticipant was disconnected, so removing Track event listeners');
      signaling.removeListener('stateChanged', stateChanged);
      media.removeListener('trackAdded', localTrackAdded);
      media.removeListener('trackRemoved', localTrackRemoved);
    }
  });
};

module.exports = LocalParticipant;
