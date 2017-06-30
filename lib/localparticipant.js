'use strict';

var util = require('./util');
var inherits = require('util').inherits;
var E = require('./util/constants').typeErrors;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalVideoTrack = require('./media/track/localvideotrack');
var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var Participant = require('./participant');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Participant}
 * in a {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {Array<LocalTrack>} localTracks
 * @param {Object} options
 * @property {Map<Track.ID, PublishedAudioTrack>} publishedAudioTracks -
 *    The {@link LocalParticipant}'s {@link PublishedAudioTrack}s
 * @property {Map<Track.ID, PublishedTrack>} publishedTracks -
 *    The {@link LocalParticipant}'s {@link PublishedTrack}s
 * @property {Map<Track.ID, PublishedVideoTrack>} publishedVideoTracks -
 *    The {@link LocalParticipant}'s {@link PublishedVideoTrack}s
 * @fires LocalParticipant#trackStopped
 */
function LocalParticipant(signaling, localTracks, options) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localTracks, options);
  }

  options = Object.assign({
    LocalAudioTrack: LocalAudioTrack,
    LocalVideoTrack: LocalVideoTrack,
    MediaStreamTrack: MediaStreamTrack,
    shouldStopLocalTracks: false,
    tracks: localTracks
  }, options);

  var tracksToStop = options.shouldStopLocalTracks
    ? new Set(localTracks)
    : new Set();

  Participant.call(this, signaling, options);
  Object.defineProperties(this, {
    _LocalAudioTrack: {
      value: options.LocalAudioTrack
    },
    _LocalVideoTrack: {
      value: options.LocalVideoTrack
    },
    _MediaStreamTrack: {
      value: options.MediaStreamTrack
    },
    _tracksToStop: {
      value: tracksToStop
    },
    publishedAudioTracks: {
      value: new Map()
    },
    pubishedTracks: {
      value: new Map()
    },
    publishedVideoTracks: {
      value: new Map()
    }
  });
}

inherits(LocalParticipant, Participant);

/**
 * Get the {@link LocalTrack} events to re-emit.
 * @private
 * @returns {Array<Array<string>>} events
 */
LocalParticipant.prototype._getTrackEvents = function _getTrackEvents() {
  return Participant.prototype._getTrackEvents.call(this).concat([
    ['disabled', 'trackDisabled'],
    ['enabled', 'trackEnabled'],
    ['stopped', 'trackStopped']
  ]);
};

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
    signaling.addTrack(localTrack.mediaStreamTrack);
    log.info('Added a new ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  function localTrackDisabled(localTrack) {
    var trackSignaling = signaling.tracks.get(localTrack.id);
    trackSignaling.disable();
    log.debug('Disabled the ' + util.trackClass(localTrack, true) + ':', localTrack.id);
  }

  function localTrackEnabled(localTrack) {
    var trackSignaling = signaling.tracks.get(localTrack.id);
    trackSignaling.enable();
    log.debug('Enabled the ' + util.trackClass(localTrack, true) + ':', localTrack.id);
  }

  function localTrackRemoved(localTrack) {
    signaling.removeTrack(localTrack.mediaStreamTrack);
    log.info('Removed a ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  this.on('trackAdded', localTrackAdded);
  this.on('trackDisabled', localTrackDisabled);
  this.on('trackEnabled', localTrackEnabled);
  this.on('trackRemoved', localTrackRemoved);
  this.tracks.forEach(localTrackAdded);

  var self = this;
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    if (state === 'disconnected') {
      log.debug('Removing LocalTrack event listeners');
      signaling.removeListener('stateChanged', stateChanged);
      self.removeListener('trackAdded', localTrackAdded);
      self.removeListener('trackDisabled', localTrackDisabled);
      self.removeListener('trackEnabled', localTrackEnabled);
      self.removeListener('trackRemoved', localTrackRemoved);

      log.info('LocalParticipant disconnected. Stopping ' +
        self._tracksToStop.size + ' automatically-acquired LocalTracks');
      self._tracksToStop.forEach(function(track) {
        track.stop();
      });
    }
  });
};

/**
 * Adds a {@link LocalTrack} to the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#publishTrack} instead
 * @param {LocalTrack} track - The {@link LocalTrack} to be added
 * @returns {?LocalTrack} - The {@link LocalTrack} if added, null if already present
 * @fires Participant#trackAdded
 * @throws {TypeError}
 *//**
 * Adds a MediaStreamTrack to the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#publishTrack} instead
 * @param {MediaStreamTrack} track - The MediaStreamTrack to be added
 * @returns {?LocalTrack} - The corresponding {@link LocalTrack} if added, null if already present
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTrack = function addTrack(track) {
  this._log.warn('LocalParticipant#addTrack has been deprecated. '
    + 'Use LocalParticipant#publishTrack instead.');
  return this._addTrack(util.asLocalTrack(track, {
    log: this._log,
    LocalAudioTrack: this._LocalAudioTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  }));
};

/**
 * Adds multiple {@link LocalTrack}s to the {@link LocalParticipant}.
 * @deprecated
 * @param {Array<LocalTrack>} tracks - The {@link LocalTrack}s to be added
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *    added; If the {@link LocalParticipant} already has a {@link LocalTrack},
 *    it won't be included in the Array
 * @fires Participant#trackAdded
 * @throws {TypeError}
 *//**
 * Adds multiple MediaStreamTracks to the {@link LocalParticipant}.
 * @deprecated
 * @param {Array<MediaStreamTrack>} tracks - The MediaStreamTracks to be added
 * @returns {Array<LocalTrack>} - The corresponding {@link LocalTrack}s that
 *    were successfully added; If the {@link LocalParticipant} already has a
 *    corresponding {@link LocalTrack} for a MediaStreamTrack, it won't be
 *    included in the Array
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTracks = function addTracks(tracks) {
  this._log.warn('LocalParticipant#addTracks has been deprecated. '
    + 'Use LocalParticipant#publishTrack instead.');
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack');
  }

  var self = this;
  return tracks.reduce(function(addedTracks, track) {
    var addedTrack = self.addTrack(track);
    return addedTrack ? addedTracks.concat(addedTrack) : addedTracks;
  }, []);
};

/**
 * Publishes a {@link LocalTrack} to the {@link Room}.
 * @param {LocalTrack} track - The {@link LocalTrack} to be published
 * @returns {Promise<PublishedTrack>} - Resolves with the corresponding
 *    {@link PublishedTrack} if successful
 *//**
 * Publishes a MediaStreamTrack to the {@link Room}.
 * @param {MediaStreamTrack} track - The MediaStreamTrack to be published
 * @returns {Promise<PublishedTrack>} - Resolves with the corresponding
 *    {@link PublishedTrack} if successful
 */
LocalParticipant.prototype.publishTrack = function publishTrack(/* track */) {};

/**
 * Removes a {@link LocalTrack} from the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#unpublishTrack} instead
 * @param {LocalTrack} track - The {@link LocalTrack} to be removed
 * @param {?boolean} [stop=true] - Whether or not to call {@link LocalTrack#stop}
 * @returns {?LocalTrack} - The corresponding {@link LocalTrack} if removed,
 *    null if the {@link LocalTrack} doesn't exist
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 *//**
 * Removes a MediaStreamTrack from the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#unpublishTrack} instead
 * @param {MediaStreamTrack} track - The MediaStreamTrack to be removed
 * @param {?boolean} [stop=true] - Whether or not to call {@link LocalTrack#stop}
 * @returns {?LocalTrack} - The corresponding {@link LocalTrack} if removed,
 *    null if the corresponding {@link LocalTrack} for MediaStreamTrack
 *    doesn't exist
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.removeTrack = function removeTrack(track, stop) {
  this._log.warn('LocalParticipant#removeTrack has been deprecated. '
    + 'Use LocalParticipant#unpublishTrack instead.');
  track = this._removeTrack(util.asLocalTrack(track, {
    log: this._log,
    LocalAudioTrack: this._LocalAudioTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  }));

  stop = typeof stop === 'boolean' ? stop : true;
  if (track && stop) {
    track.stop();
    this._log.info('Stopped LocalTrack:', track);
  }
  return track;
};

/**
 * Removes multiple {@link LocalTrack}s from the {@link LocalParticipant}.
 * @deprecated
 * @param {Array<LocalTrack>} tracks - The {@link LocalTrack}s to be removed
 * @param {?boolean} [stop=true] - Whether or not to call {@link LocalTrack#stop}
 *    on each {@link LocalTrack} that was successfully removed
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *    removed; If the {@link LocalParticipant} doesn't have a {@link LocalTrack}
 *    that is to be removed, it won't be included in the Array
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 *//**
 * Removes multiple MediaStreamTracks from the {@link LocalParticipant}.
 * @deprecated
 * @param {Array<MediaStreamTrack>} tracks - The MediaStreamTracks to be removed
 * @param {?boolean} [stop=true] - Whether or not to call {@link LocalTrack#stop}
 *    on each {@link LocalTrack} that was successfully removed
 * @returns {Array<LocalTrack>} - The corresponding {@link LocalTrack}s that
 *    were successfully removed; If the {@link LocalParticipant} doesn't have
 *    the corresponding {@link LocalTrack} for a MediaStreamTrack that is to
 *    be removed, it won't be included in the Array
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.removeTracks = function removeTracks(tracks, stop) {
  this._log.warn('LocalParticipant#removeTracks has been deprecated. '
    + 'Use LocalParticipant#unpublishTrack instead.');
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack');
  }

  var self = this;
  return tracks.reduce(function(removedTracks, track) {
    var removedTrack = self.removeTrack(track, stop);
    return removedTrack ? removedTracks.concat(removedTrack) : removedTracks;
  }, []);
};


/**
 * Set the {@link LocalParticipant}'s {@link EncodingParameters}.
 * @param {?EncodingParameters} [encodingParameters] - The new
 *   {@link EncodingParameters}; If null, then the bitrate limits are removed;
 *   If not specified, then the existing bitrate limits are preserved
 * @returns {this}
 * @throws {TypeError}
 */
LocalParticipant.prototype.setParameters = function setParameters(encodingParameters) {
  if (typeof encodingParameters !== 'undefined'
    && typeof encodingParameters !== 'object') {
    throw new E.INVALID_TYPE('encodingParameters',
      'EncodingParameters, null or undefined');
  }

  if (encodingParameters) {
    ['maxAudioBitrate', 'maxVideoBitrate'].forEach(function(prop) {
      if (typeof encodingParameters[prop] !== 'undefined'
        && typeof encodingParameters[prop] !== 'number'
        && encodingParameters[prop] !== null) {
        throw new E.INVALID_TYPE('encodingParameters.' + prop, 'number, null or undefined');
      }
    });
  } else if (encodingParameters === null) {
    encodingParameters = { maxAudioBitrate: null, maxVideoBitrate: null };
  }

  this._signaling.setParameters(encodingParameters);
  return this;
};

/**
 * Stops publishing a {@link LocalTrack} to the {@link Room}.
 * @param {LocalTrack} track - The {@link LocalTrack} to stop being published
 *//**
 * Stops publishing a MediaStreamTrack to the {@link Room}.
 * @param {MediaStreamTrack} track - The MediaStreamTrack to stop being published
 */
LocalParticipant.prototype.unpublishTrack = function unpublishTrack(/* track */) {};

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrack}s stopped, either
 * because {@link LocalTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalTrack} track - The {@link LocalTrack} that stopped
 * @event LocalParticipant#trackStopped
 */

/**
 * Outgoing media encoding parameters.
 * @typedef {object} EncodingParameters
 * @property {?number} [maxAudioBitrate] - Max outgoing audio bitrate (bps);
 *   If not specified, retains the existing bitrate limit; A <code>null</code>
 *   value removes any previously set bitrate limit
 * @property {?number} [maxVideoBitrate] - Max outgoing video bitrate (bps);
 *   If not specified, retains the existing bitrate limit; A <code>null</code>
 *   value removes any previously set bitrate limit
 */

module.exports = LocalParticipant;
