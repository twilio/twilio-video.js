'use strict';

var util = require('./util');
var inherits = require('util').inherits;
var E = require('./util/constants').typeErrors;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalVideoTrack = require('./media/track/localvideotrack');
var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var Participant = require('./participant');
var LocalAudioTrackPublication = require('./media/track/localaudiotrackpublication');
var LocalVideoTrackPublication = require('./media/track/localvideotrackpublication');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Participant}
 * in a {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {Array<LocalTrack>} localTracks
 * @param {Object} options
 * @property {Map<Track.ID, LocalAudioTrackPublication>} audioTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalAudioTrackPublication}s
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks -
 *   The {@link LocalParticipant}'s {@link LocalAudioTrack}s
 * @property {Map<Track.ID, LocalTrackPublication>} trackPublications -
 *    The {@link LocalParticipant}'s {@link LocalTrackPublication}s
 * @property {Map<Track.ID, LocalTrack>} tracks -
 *    The {@link LocalParticipant}'s {@link LocalTrack}s
 * @property {Map<Track.ID, LocalVideoTrackPublication>} videoTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalVideoTrackPublication}s
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks -
 *   The {@link LocalParticipant}'s {@link LocalVideoTrack}s
 * @fires LocalParticipant#trackAdded
 * @fires LocalParticipant#trackDimensionsChanged
 * @fires LocalParticipant#trackDisabled
 * @fires LocalParticipant#trackEnabled
 * @fires LocalParticipant#trackRemoved
 * @fires LocalParticipant#trackStarted
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
    LocalAudioTrackPublication: LocalAudioTrackPublication,
    LocalVideoTrackPublication: LocalVideoTrackPublication,
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
    _LocalAudioTrackPublication: {
      value: options.LocalAudioTrackPublication
    },
    _LocalVideoTrackPublication: {
      value: options.LocalVideoTrackPublication
    },
    _tracksToStop: {
      value: tracksToStop
    },
    audioTrackPublications: {
      value: new Map()
    },
    trackPublications: {
      value: new Map()
    },
    videoTrackPublications: {
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

  var self = this;
  var tracks = Array.from(this.tracks.values());

  Object.defineProperty(this, '_initialTracksPublished', {
    value: tracks.map(function(track) {
      localTrackAdded(track);
      return self._getOrCreateLocalTrackPublication(track);
    })
  });

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

LocalParticipant.prototype._getOrCreateLocalTrackPublication = function _getOrCreateLocalTrackPublication(localTrack) {
  var log = this._log;
  var self = this;
  var trackSignaling = this._signaling.tracks.get(localTrack.id);

  if (!trackSignaling) {
    return Promise.reject(new Error('Unexpected error: The ' + localTrack
      + ' cannot be published'));
  }

  return trackSignaling.getSid().then(function(sid) {
    if (!self.tracks.has(localTrack.id)) {
      throw new Error('The ' + localTrack + ' was unpublished');
    }

    var options = {
      log: log,
      LocalAudioTrackPublication: self._LocalAudioTrackPublication,
      LocalVideoTrackPublication: self._LocalVideoTrackPublication
    };

    var publishedKindTracks = localTrack.kind === 'audio'
      ? self.audioTrackPublications
      : self.videoTrackPublications;

    var localTrackPublication = self.trackPublications.get(localTrack.id);
    var unpublish = self.unpublishTrack.bind(self);

    if (!localTrackPublication) {
      localTrackPublication = util.asLocalTrackPublication(localTrack, sid, unpublish, options);
      self.trackPublications.set(localTrack.id, localTrackPublication);
      publishedKindTracks.set(localTrack.id, localTrackPublication);
      log.info('Created a new ' + util.trackClass(localTrack) + 'Publication:', sid);
    }
    return localTrackPublication;
  }, function(error) {
    log.warn('Failed to publish the ' + util.trackClass(localTrack, true) + ':', error);
    self._removeTrack(localTrack);
    throw error;
  });
};

/**
 * Adds a {@link LocalTrack} to the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#publishTrack} instead
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack} to add;
 *   if a MediaStreamTrack is provided, and a corresponding {@link LocalTrack}
 *   has not yet been added, this method will construct one
 * @returns {?LocalTrack} - The {@link LocalTrack} if added, null if already
 *   present
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTrack = function addTrack(track) {
  this._log.deprecated('LocalParticipant#addTrack has been deprecated. '
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
 * @deprecated Use {@link LocalParticipant#publishTracks} instead
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to add; for any MediaStreamTracks provided, if a corresponding
 *   {@link LocalTrack} has not yet been added, this method will construct one
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *   added; if the {@link LocalParticipant} already has a {@link LocalTrack},
 *   it won't be included in the Array
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTracks = function addTracks(tracks) {
  this._log.deprecated('LocalParticipant#addTracks has been deprecated. '
    + 'Use LocalParticipant#publishTracks instead.');
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
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack} to
 *   publish; if a MediaStreamTrack is provided, and a corresponding
 *   {@link LocalTrack} has not yet been published, this method will construct
 *   one
 * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
 *    {@link LocalTrackPublication} if successful
 * @fires Participant#trackAdded
 */
LocalParticipant.prototype.publishTrack = function publishTrack(track) {
  try {
    var localTrack = util.asLocalTrack(track, {
      log: this._log,
      LocalAudioTrack: this._LocalAudioTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    });
  } catch (error) {
    return Promise.reject(error);
  }

  if (this.trackPublications.has(localTrack.id)) {
    return Promise.resolve(this.trackPublications.get(localTrack.id));
  }
  this._addTrack(localTrack);
  return this._getOrCreateLocalTrackPublication(localTrack);
};

/**
 * Publishes multiple {@link LocalTrack}s to the {@link Room}.
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to publish; for any MediaStreamTracks provided, if a corresponding
 *   {@link LocalTrack} has not yet been published, this method will construct
 *   one
 * @returns {Promise<Array<LocalTrackPublication>>} - The resulting
 *   {@link LocalTrackPublication}s
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.publishTracks = function publishTracks(tracks) {
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack');
  }
  return Promise.all(tracks.map(this.publishTrack, this));
};

/**
 * Removes a {@link LocalTrack} from the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#unpublishTrack} instead
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack} to
 *   remove; if a MediaStreamTrack is provided, this method looks up the
 *   corresponding {@link LocalTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop}
 * @returns {?LocalTrack} - The corresponding {@link LocalTrack} if removed,
 *    null if the {@link LocalTrack} doesn't exist
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.removeTrack = function removeTrack(track, stop) {
  this._log.deprecated('LocalParticipant#removeTrack has been deprecated. '
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
 * @deprecated Use {@link LocalParticipant#unpublishTracks} instead
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to remove; for any MediaStreamTracks provided, this method looks up the
 *   corresponding {@Link LocalTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop} on each {@link LocalTrack} that was successfully
 *   removed
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *   removed; If the {@link LocalParticipant} doesn't have a {@link LocalTrack}
 *   that is to be removed, it won't be included in the Array
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.removeTracks = function removeTracks(tracks, stop) {
  this._log.deprecated('LocalParticipant#removeTracks has been deprecated. '
    + 'Use LocalParticipant#unpublishTracks instead.');
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
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack} to stop
 *   publishing; if a MediaStreamTrack is provided, this method looks up the
 *   corresponding {@link LocalTrack} to stop publishing
 * @returns {?LocalTrackPublication} - The corresponding
 *   {@link LocalTrackPublication} if the {@link LocalTrack} was previously
 *   published, null otherwise.
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.unpublishTrack = function unpublishTrack(track) {
  util.validateLocalTrack(track, {
    LocalAudioTrack: this._LocalAudioTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  });

  var localTrack = this.tracks.get(track.id);
  if (!localTrack) {
    return null;
  }

  var trackSignaling = this._signaling.tracks.get(localTrack.id);
  trackSignaling.publishFailed(new Error('The ' + localTrack + ' was unpublished'));

  var publishedKindTracks = localTrack.kind === 'audio'
    ? this.audioTrackPublications
    : this.videoTrackPublications;
  var localTrackPublication = this.trackPublications.get(localTrack.id) || null;

  publishedKindTracks.delete(localTrack.id);
  this.trackPublications.delete(localTrack.id);
  this._removeTrack(localTrack);

  return localTrackPublication;
};

/**
 * Stops publishing multiple {@link LocalTrack}s to the {@link Room}.
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to stop publishing; for any MediaStreamTracks provided, this method looks
 *   up the corresponding {@link LocalTrack} to stop publishing
 * @returns {Array<LocalTrack>} - The corresponding
 *   {@link LocalTrackPublication}s that were successfully unpublished
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.unpublishTracks = function unpublishTracks(tracks) {
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack');
  }

  var self = this;
  return tracks.reduce(function(unpublishedTracks, track) {
    var unpublishedTrack = self.unpublishTrack(track);
    return unpublishedTrack ? unpublishedTracks.concat(unpublishedTrack) : unpublishedTracks;
  }, []);
};

/**
 * A {@link LocalTrack} was added by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was added
 * @event LocalParticipant#trackAdded
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalVideoTrack}'s dimensions changed.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} whose dimensions changed
 * @event LocalParticipant#trackDimensionsChanged
 */

/**
 * A {@link LocalTrack} was disabled by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was disabled
 * @event LocalParticipant#trackDisabled
 */

/**
 * A {@link LocalTrack} was enabled by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was enabled
 * @event LocalParticipant#trackEnabled
 */

/**
 * A {@link LocalTrack} was removed by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was removed
 * @event LocalParticipant#trackRemoved
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrack}s started.
 * @param {LocalTrack} track - The {@link LocalTrack} that started
 * @event LocalParticipant#trackStarted
 */

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
