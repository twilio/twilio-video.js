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
 * @param {Array<LocalTrack>} localTracks
 * @param {Object} options
 */
function LocalParticipant(signaling, localTracks, options) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localTracks, options);
  }
  Participant.call(this, signaling, Object.assign({
    tracks: localTracks
  }, options));
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

  this.on('trackAdded', localTrackAdded);
  this.on('trackRemoved', localTrackRemoved);
  this.tracks.forEach(localTrackAdded);

  var self = this;
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    if (state === 'disconnected') {
      log.debug('Removing LocalTrack event listeners');
      signaling.removeListener('stateChanged', stateChanged);
      self.removeListener('trackAdded', localTrackAdded);
      self.removeListener('trackRemoved', localTrackRemoved);
    }
  });
};

/**
 * Adds a {@link LocalTrack} to the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} to be added
 * @returns {this}
 * @fires Participant#trackAdded
 */
LocalParticipant.prototype.addTrack = function addTrack(track) {
  return this._addTrack(track);
};

/**
 * Removes a {@link LocalTrack} from the {@link LocalParticipant}, if it was added.
 * @param {LocalTrack} track - The {@link LocalTrack} to be removed
 * @param {?boolean} [stop=true] - Whether or not to call {@link LocalTrack#stop}
 * @returns {this}
 * @fires Participant#trackRemoved
 */
LocalParticipant.prototype.removeTrack = function removeTrack(track, stop) {
  var log = this._log;

  this._removeTrack(track);

  if (typeof stop === 'boolean' ? stop : true) {
    track.stop();
    log.info('Stopped LocalTrack:', track);
  }

  return this;
};

module.exports = LocalParticipant;
