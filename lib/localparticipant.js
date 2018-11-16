'use strict';

const util = require('./util');
const E = require('./util/constants').typeErrors;
const LocalAudioTrack = require('./media/track/es5/localaudiotrack');
const LocalDataTrack = require('./media/track/es5/localdatatrack');
const LocalVideoTrack = require('./media/track/es5/localvideotrack');
const MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
const Participant = require('./participant');
const LocalAudioTrackPublication = require('./media/track/localaudiotrackpublication');
const LocalDataTrackPublication = require('./media/track/localdatatrackpublication');
const LocalVideoTrackPublication = require('./media/track/localvideotrackpublication');

/**
 * A {@link LocalParticipant} represents the local {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, LocalAudioTrackPublication>} audioTracks -
 *    The {@link LocalParticipant}'s {@link LocalAudioTrackPublication}s
 * @property {Map<Track.SID, LocalDataTrackPublication>} dataTracks -
 *    The {@link LocalParticipant}'s {@link LocalDataTrackPublication}s
 * @property {Map<Track.SID, LocalTrackPublication>} tracks -
 *    The {@link LocalParticipant}'s {@link LocalTrackPublication}s
 * @property {Map<Track.SID, LocalVideoTrackPublication>} videoTracks -
 *    The {@link LocalParticipant}'s {@link LocalVideoTrackPublication}s
 * @emits LocalParticipant#trackDimensionsChanged
 * @emits LocalParticipant#trackDisabled
 * @emits LocalParticipant#trackEnabled
 * @emits LocalParticipant#trackPublicationFailed
 * @emits LocalParticipant#trackPublished
 * @emits LocalParticipant#trackStarted
 * @emits LocalParticipant#trackStopped
 */
class LocalParticipant extends Participant {
  /**
   * Construct a {@link LocalParticipant}.
   * @param {ParticipantSignaling} signaling
   * @param {Array<LocalTrack>} localTracks
   * @param {Object} options
   */
  constructor(signaling, localTracks, options) {
    options = Object.assign({
      LocalAudioTrack,
      LocalVideoTrack,
      LocalDataTrack,
      MediaStreamTrack,
      LocalAudioTrackPublication,
      LocalVideoTrackPublication,
      LocalDataTrackPublication,
      shouldStopLocalTracks: false,
      tracks: localTracks
    }, options);

    const tracksToStop = options.shouldStopLocalTracks
      ? new Set(localTracks.filter(localTrack => localTrack.kind !== 'data'))
      : new Set();

    super(signaling, options);

    Object.defineProperties(this, {
      _LocalAudioTrack: {
        value: options.LocalAudioTrack
      },
      _LocalDataTrack: {
        value: options.LocalDataTrack
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
      _LocalDataTrackPublication: {
        value: options.LocalDataTrackPublication
      },
      _LocalVideoTrackPublication: {
        value: options.LocalVideoTrackPublication
      },
      _tracksToStop: {
        value: tracksToStop
      }
    });

    this._handleTrackSignalingEvents();
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @param {Track.ID} id
   * @returns {?LocalTrack}
   */
  _addTrack(track, id) {
    const addedTrack = super._addTrack(track, id);
    if (addedTrack && this.state !== 'disconnected') {
      this._addLocalTrack(track);
    }
    return addedTrack;
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @returns {void}
   */
  _addLocalTrack(track) {
    this._signaling.addTrack(track._trackSender, track.name);
    this._log.info(`Added a new ${util.trackClass(track, true)}:`, track.id);
    this._log.debug(`${util.trackClass(track, true)}:`, track);
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @param {Track.ID} id
   * @returns {?LocalTrack}
   */
  _removeTrack(track, id) {
    const removedTrack = super._removeTrack(track, id);
    if (removedTrack && this.state !== 'disconnected') {
      this._signaling.removeTrack(track._trackSender);
      this._log.info(`Removed a ${util.trackClass(track, true)}:`, track.id);
      this._log.debug(`${util.trackClass(track, true)}:`, track);
    }
    return removedTrack;
  }

  /**
   * Get the {@link LocalTrack} events to re-emit.
   * @private
   * @returns {Array<Array<string>>} events
   */
  _getTrackEvents() {
    return super._getTrackEvents.call(this).concat([
      ['disabled', 'trackDisabled'],
      ['enabled', 'trackEnabled'],
      ['stopped', 'trackStopped']
    ]);
  }

  toString() {
    return `[LocalParticipant #${this._instanceId}${this.sid ? `: ${this.sid}` : ''}]`;
  }

  /**
   * @private
   */
  _handleTrackSignalingEvents() {
    const log = this._log;

    if (this.state === 'disconnected') {
      return;
    }

    const signaling = this._signaling;

    function localTrackDisabled(localTrack) {
      const trackSignaling = signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.disable();
        log.debug(`Disabled the ${util.trackClass(localTrack, true)}:`, localTrack.id);
      }
    }

    function localTrackEnabled(localTrack) {
      const trackSignaling = signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.enable();
        log.debug(`Enabled the ${util.trackClass(localTrack, true)}:`, localTrack.id);
      }
    }

    function localTrackStopped(localTrack) {
      // NOTE(mroberts): We shouldn't need to check for `stop`, since DataTracks
      // do not emit "stopped".
      const trackSignaling = signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.stop();
      }
    }

    this.on('trackDisabled', localTrackDisabled);
    this.on('trackEnabled', localTrackEnabled);
    this.on('trackStopped', localTrackStopped);

    this._tracks.forEach(track => {
      this._addLocalTrack(track);
      this._getOrCreateLocalTrackPublication(track).catch(() => {
        // Do nothing for now.
      });
    });

    const self = this;
    signaling.on('stateChanged', function stateChanged(state) {
      log.debug('Transitioned to state:', state);
      if (state === 'disconnected') {
        log.debug('Removing LocalTrack event listeners');
        signaling.removeListener('stateChanged', stateChanged);
        self.removeListener('trackDisabled', localTrackDisabled);
        self.removeListener('trackEnabled', localTrackEnabled);
        self.removeListener('trackStopped', localTrackStopped);
        self._tracks.forEach(localTrackStopped);

        log.info(`LocalParticipant disconnected. Stopping ${self._tracksToStop.size} automatically-acquired LocalTracks`);
        self._tracksToStop.forEach(track => {
          track.stop();
        });
      }
    });
  }

  /**
   * @private
   * @param {LocalTrack} localTrack
   * @returns {Promise<LocalTrackPublication>}
   */
  _getOrCreateLocalTrackPublication(localTrack) {
    let localTrackPublication = getTrackPublication(this.tracks, localTrack);
    if (localTrackPublication) {
      return Promise.resolve(localTrackPublication);
    }

    const log = this._log;
    const self = this;

    const trackSignaling = this._signaling.getPublication(localTrack._trackSender);
    if (!trackSignaling) {
      return Promise.reject(new Error(`Unexpected error: The ${localTrack} cannot be published`));
    }

    function unpublish(publication) {
      self.unpublishTrack(publication.track);
    }

    return new Promise((resolve, reject) => {
      function updated() {
        const error = trackSignaling.error;
        if (error) {
          trackSignaling.removeListener('updated', updated);
          log.warn(`Failed to publish the ${util.trackClass(localTrack, true)}: ${error.message}`);
          self._removeTrack(localTrack, localTrack.id);
          setTimeout(() => {
            self.emit('trackPublicationFailed', error, localTrack);
          });
          reject(error);
          return;
        }

        if (!self._tracks.has(localTrack.id)) {
          trackSignaling.removeListener('updated', updated);
          reject(new Error(`The ${localTrack} was unpublished`));
          return;
        }

        const sid = trackSignaling.sid;
        if (!sid) {
          return;
        }

        trackSignaling.removeListener('updated', updated);

        const options = {
          log,
          LocalAudioTrackPublication: self._LocalAudioTrackPublication,
          LocalDataTrackPublication: self._LocalDataTrackPublication,
          LocalVideoTrackPublication: self._LocalVideoTrackPublication
        };

        localTrackPublication = getTrackPublication(self.tracks, localTrack);

        if (!localTrackPublication) {
          localTrackPublication = util.asLocalTrackPublication(localTrack, sid, unpublish, options);
          self._addTrackPublication(localTrackPublication);
        }

        if (self._signaling.state === 'connected') {
          setTimeout(() => {
            self.emit('trackPublished', localTrackPublication);
          });
        }
        resolve(localTrackPublication);
      }

      trackSignaling.on('updated', updated);
    });
  }

  /**
   * Publishes a {@link LocalTrack} to the {@link Room}.
   * @param {LocalTrack} localTrack - The {@link LocalTrack} to publish
   * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
   *   {@link LocalTrackPublication} if successful
  *//**
   * Publishes a MediaStreamTrack to the {@link Room}.
   * @param {MediaStreamTrack} mediaStreamTrack - The MediaStreamTrack
   *   to publish; if a corresponding {@link LocalAudioTrack} or
   *   {@link LocalVideoTrack} has not yet been published, this method will
   *   construct one
   * @param {LocalTrackOptions} [options] - The {@link LocalTrackOptions} for
   *   constructing the  MediaStreamTrack's corresponding {@link LocalAudioTrack}
   *   or {@link LocalVideoTrack}
   * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
   *   {@link LocalTrackPublication} if successful
   * @example
   * var Video = require('twilio-video');
   *
   * Video.connect(token, {
   *   name: 'my-cool-room',
   *   audio: true
   * }).then(function(room) {
   *   // Publish a video MediaStreamTrack with a custom name
   *   return room.localParticipant.publishTrack(mediaStreamTrack, {
   *     name: 'camera'
   *   });
   * }).then(function(publication) {
   *   console.log('The LocalTrack "' + publication.trackName + '" was successfully published');
   * });
   */
  publishTrack(localTrackOrMediaStreamTrack, options) {
    const trackPublication = getTrackPublication(this.tracks, localTrackOrMediaStreamTrack);
    if (trackPublication) {
      return Promise.resolve(trackPublication);
    }

    options = Object.assign({
      log: this._log,
      LocalAudioTrack: this._LocalAudioTrack,
      LocalDataTrack: this._LocalDataTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    }, options);

    let localTrack;
    try {
      localTrack = util.asLocalTrack(localTrackOrMediaStreamTrack, options);
    } catch (error) {
      return Promise.reject(error);
    }

    let addedLocalTrack = this._addTrack(localTrack, localTrack.id)
      || this._tracks.get(localTrack.id);

    return this._getOrCreateLocalTrackPublication(addedLocalTrack);
  }

  /**
   * Publishes multiple {@link LocalTrack}s to the {@link Room}.
   * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
   *   to publish; for any MediaStreamTracks provided, if a corresponding
   *   {@link LocalAudioTrack} or {@link LocalVideoTrack} has not yet been
   *   published, this method will construct one
   * @returns {Promise<Array<LocalTrackPublication>>} - The resulting
   *   {@link LocalTrackPublication}s
   * @throws {TypeError}
   */
  publishTracks(tracks) {
    if (!Array.isArray(tracks)) {
      // eslint-disable-next-line new-cap
      throw E.INVALID_TYPE('tracks',
        'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
    }
    return Promise.all(tracks.map(this.publishTrack, this));
  }

  /**
   * Set the {@link LocalParticipant}'s {@link EncodingParameters}.
   * @param {?EncodingParameters} [encodingParameters] - The new
   *   {@link EncodingParameters}; If null, then the bitrate limits are removed;
   *   If not specified, then the existing bitrate limits are preserved
   * @returns {this}
   * @throws {TypeError}
   */
  setParameters(encodingParameters) {
    if (typeof encodingParameters !== 'undefined'
      && typeof encodingParameters !== 'object') {
      // eslint-disable-next-line new-cap
      throw E.INVALID_TYPE('encodingParameters',
        'EncodingParameters, null or undefined');
    }

    if (encodingParameters) {
      ['maxAudioBitrate', 'maxVideoBitrate'].forEach(prop => {
        if (typeof encodingParameters[prop] !== 'undefined'
          && typeof encodingParameters[prop] !== 'number'
          && encodingParameters[prop] !== null) {
          // eslint-disable-next-line new-cap
          throw E.INVALID_TYPE(`encodingParameters.${prop}`, 'number, null or undefined');
        }
      });
    } else if (encodingParameters === null) {
      encodingParameters = { maxAudioBitrate: null, maxVideoBitrate: null };
    }

    this._signaling.setParameters(encodingParameters);
    return this;
  }

  /**
   * Stops publishing a {@link LocalTrack} to the {@link Room}.
   * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack}
   *   to stop publishing; if a MediaStreamTrack is provided, this method
   *   looks up the corresponding {@link LocalAudioTrack} or
   *   {@link LocalVideoTrack} to stop publishing
   * @returns {?LocalTrackPublication} - The corresponding
   *   {@link LocalTrackPublication} if the {@link LocalTrack} was previously
   *   published, null otherwise
   * @throws {TypeError}
  */
  unpublishTrack(track) {
    util.validateLocalTrack(track, {
      LocalAudioTrack: this._LocalAudioTrack,
      LocalDataTrack: this._LocalDataTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    });

    let localTrack = this._tracks.get(track.id);
    if (!localTrack) {
      return null;
    }

    const trackSignaling = this._signaling.getPublication(localTrack._trackSender);
    trackSignaling.publishFailed(new Error(`The ${localTrack} was unpublished`));

    localTrack = this._removeTrack(localTrack, localTrack.id);
    if (!localTrack) {
      return null;
    }

    const localTrackPublication = getTrackPublication(this.tracks, localTrack);
    if (localTrackPublication) {
      this._removeTrackPublication(localTrackPublication);
    }
    return localTrackPublication;
  }

  /**
   * Stops publishing multiple {@link LocalTrack}s to the {@link Room}.
   * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
   *   to stop publishing; for any MediaStreamTracks provided, this method looks
   *   up the corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to
   *   stop publishing
   * @returns {Array<LocalTrackPublication>} - The corresponding
   *   {@link LocalTrackPublication}s that were successfully unpublished
   * @throws {TypeError}
   */
  unpublishTracks(tracks) {
    if (!Array.isArray(tracks)) {
      // eslint-disable-next-line new-cap
      throw E.INVALID_TYPE('tracks',
        'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
    }

    return tracks.reduce((unpublishedTracks, track) => {
      const unpublishedTrack = this.unpublishTrack(track);
      return unpublishedTrack ? unpublishedTracks.concat(unpublishedTrack) : unpublishedTracks;
    }, []);
  }
}

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
 * A {@link LocalTrack} failed to publish. Check the error message for more
 * information.
 * @param {TwilioError} error - A {@link TwilioError} explaining why publication
 *   failed
 * @param {LocalTrack} localTrack - The {@link LocalTrack} that failed to
 *   publish
 * @event LocalParticipant#trackPublicationFailed
 */

/**
 * A {@link LocalTrack} was successfully published.
 * @param {LocalTrackPublication} publication - The resulting
 *   {@link LocalTrackPublication} for the published {@link LocalTrack}
 * @event LocalParticipant#trackPublished
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

/**
 * @private
 * @param {Map<Track.SID, LocalTrackPublication>} trackPublications
 * @param {LocalTrack|MediaStreamTrack} track
 * @returns {?LocalTrackPublication} trackPublication
 */
function getTrackPublication(trackPublications, track) {
  return Array.from(trackPublications.values()).find(trackPublication => trackPublication.track === track
    || trackPublication.track.mediaStreamTrack === track) || null;
}

module.exports = LocalParticipant;
