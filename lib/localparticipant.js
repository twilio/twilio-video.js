'use strict';

var util = require('./util');
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
  options.media = localMedia;
  Participant.call(this, signaling, options);
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
    log.info('Added a new ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  function localTrackRemoved(localTrack) {
    signaling.removeTrack(localTrack._signaling);
    log.info('Removed a ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  media.on('trackAdded', localTrackAdded);
  media.on('trackRemoved', localTrackRemoved);

  media.tracks.forEach(localTrackAdded);

  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    if (state === 'disconnected') {
      log.debug('Removing LocalTrack event listeners');
      signaling.removeListener('stateChanged', stateChanged);
      media.removeListener('trackAdded', localTrackAdded);
      media.removeListener('trackRemoved', localTrackRemoved);
    }
  });
};

module.exports = LocalParticipant;
