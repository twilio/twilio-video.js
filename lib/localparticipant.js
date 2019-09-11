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
 * @property {Map<Track.SID, LocalAudioTrackPublication>} audioTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalAudioTrackPublication}s
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks -
 *   The {@link LocalParticipant}'s {@link LocalAudioTrack}s
 * @property {Map<Track.SID, LocalDataTrackPublication>} dataTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalDataTrackPublication}s
 * @property {Map<Track.ID, LocalDataTrack>} dataTracks -
 *   The {@link LocalParticipant}'s {@link LocalDataTrack}s
 * @property {Map<Track.SID, LocalTrackPublication>} trackPublications -
 *    The {@link LocalParticipant}'s {@link LocalTrackPublication}s
 * @property {Map<Track.ID, LocalTrack>} tracks -
 *    The {@link LocalParticipant}'s {@link LocalTrack}s
 * @property {Map<Track.SID, LocalVideoTrackPublication>} videoTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalVideoTrackPublication}s
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks -
 *   The {@link LocalParticipant}'s {@link LocalVideoTrack}s
 * @emits LocalParticipant#trackAdded
 * @emits LocalParticipant#trackDimensionsChanged
 * @emits LocalParticipant#trackDisabled
 * @emits LocalParticipant#trackEnabled
 * @emits LocalParticipant#trackPublicationFailed
 * @emits LocalParticipant#trackPublished
 * @emits LocalParticipant#trackRemoved
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

    util.deprecateEvents('LocalParticipant', this, new Map([
      ['trackAdded', null],
      ['trackRemoved', null]
    ]), this._log);
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @returns {?LocalTrack}
   */
  _addTrack(track) {
    const addedTrack = super._addTrack(track);
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
   * @returns {?LocalTrack}
   */
  _removeTrack(track) {
    const removedTrack = super._removeTrack(track);
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
      const trackSignaling = signaling.tracks.get(localTrack.id);
      if (trackSignaling) {
        trackSignaling.disable();
        log.debug(`Disabled the ${util.trackClass(localTrack, true)}:`, localTrack.id);
      }
    }

    function localTrackEnabled(localTrack) {
      const trackSignaling = signaling.tracks.get(localTrack.id);
      if (trackSignaling) {
        trackSignaling.enable();
        log.debug(`Enabled the ${util.trackClass(localTrack, true)}:`, localTrack.id);
      }
    }

    this.on('trackDisabled', localTrackDisabled);
    this.on('trackEnabled', localTrackEnabled);

    this.tracks.forEach(track => {
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

        log.info(`LocalParticipant disconnected. Stopping ${self._tracksToStop.size} automatically-acquired LocalTracks`);
        self._tracksToStop.forEach(track => {
          track.stop();
        });
      }
    });
  }

  /**
   * @private
   */
  _getOrCreateLocalTrackPublication(localTrack) {
    let localTrackPublication = getTrackPublication(this.trackPublications, localTrack);
    if (localTrackPublication) {
      return localTrackPublication;
    }

    const log = this._log;
    const self = this;

    const trackSignaling = this._signaling.tracks.get(localTrack.id);
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
          self._removeTrack(localTrack);
          setTimeout(() => {
            self.emit('trackPublicationFailed', error, localTrack);
          });
          reject(error);
          return;
        }

        if (!self.tracks.has(localTrack.id)) {
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

        localTrackPublication = getTrackPublication(self.trackPublications, localTrack);

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
  addTrack(track) {
    this._log.deprecated('LocalParticipant#addTrack has been deprecated. '
      + 'Use LocalParticipant#publishTrack instead.');
    util.validateLocalTrack(track, {
      LocalAudioTrack: this._LocalAudioTrack,
      LocalDataTrack: this._LocalDataTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    });
    if (this.tracks.has(track.id)) {
      return null;
    }
    this.publishTrack(track).catch(() => {
      // Do nothing.
    });
    return this.tracks.get(track.id);
  }

  /**
   * Adds multiple {@link LocalTrack}s to the {@link LocalParticipant}.
   * @deprecated Use {@link LocalParticipant#publishTracks} instead
   * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
   *   to add; for any MediaStreamTracks provided, if a corresponding
   *   {@link LocalAudioTrack} or {@link LocalVideoTrack} has not yet been added,
   *   this method will construct one
   * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
   *   added; if the {@link LocalParticipant} already has a {@link LocalTrack},
   *   it won't be included in the Array
   * @fires Participant#trackAdded
   * @throws {TypeError}
   */
  addTracks(tracks) {
    this._log.deprecated('LocalParticipant#addTracks has been deprecated. '
      + 'Use LocalParticipant#publishTracks instead.');
    if (!Array.isArray(tracks)) {
      // eslint-disable-next-line new-cap
      throw E.INVALID_TYPE('tracks',
        'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
    }
    tracks = tracks.filter(function(track) {
      return !this.tracks.has(track.id);
    }, this);
    this.publishTracks(tracks).catch(() => {
      // Do nothing.
    });
    return tracks.map(function(track) {
      return this.tracks.get(track.id);
    }, this);
  }

  /**
   * Publishes a {@link LocalTrack} to the {@link Room}.
   * @param {LocalTrack} localTrack - The {@link LocalTrack} to publish
   * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
   *   {@link LocalTrackPublication} if successful
   * @fires Participant#trackAdded
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
   * @fires Participant#trackAdded
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
    const trackPublication = getTrackPublication(this.trackPublications, localTrackOrMediaStreamTrack);
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

    localTrack = this._addTrack(localTrack) || this.tracks.get(localTrack.id);
    return this._getOrCreateLocalTrackPublication(localTrack);
  }

  /**
   * Publishes multiple {@link LocalTrack}s to the {@link Room}.
   * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
   *   to publish; for any MediaStreamTracks provided, if a corresponding
   *   {@link LocalAudioTrack} or {@link LocalVideoTrack} has not yet been
   *   published, this method will construct one
   * @returns {Promise<Array<LocalTrackPublication>>} - The resulting
   *   {@link LocalTrackPublication}s
   * @fires Participant#trackAdded
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
   * Removes a {@link LocalTrack} from the {@link LocalParticipant}.
   * @deprecated Use {@link LocalParticipant#unpublishTrack} instead
   * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack}
   *   to remove; if a MediaStreamTrack is provided, this method looks up the
   *   corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to remove
   * @param {?boolean} [stop=true] - Whether or not to call
   *   {@link LocalAudioTrack#stop} or {@link LocalVideoTrack#stop}
   * @returns {?LocalTrack} - The {@link LocalTrack} removed, otherwise null
   * @fires Participant#trackRemoved
   * @throws {TypeError}
  */
  removeTrack(track, stop) {
    this._log.deprecated('LocalParticipant#removeTrack has been deprecated. '
      + 'Use LocalParticipant#unpublishTrack instead.');
    const publication = this.unpublishTrack(track);
    track = publication && publication.track;
    stop = typeof stop === 'boolean' ? stop : true;
    if (track && stop && track.kind !== 'data' ) {
      track.stop();
      this._log.info('Stopped LocalTrack:', track);
    }
    return track;
  }

  /**
   * Removes multiple {@link LocalTrack}s from the {@link LocalParticipant}.
   * @deprecated Use {@link LocalParticipant#unpublishTracks} instead
   * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
   *   to remove; for any MediaStreamTracks provided, this method looks up the
   *   corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to remove
   * @param {?boolean} [stop=true] - Whether or not to call
   *   {@link LocalAudioTrack#stop} or {@link LocalVideoTrack#stop} on each
   *   {@link LocalAudioTrack} or {@link LocalVideoTrack} that was successfully
   *   removed
   * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
   *   removed
   * @fires Participant#trackRemoved
   * @throws {TypeError}
   */
  removeTracks(tracks, stop) {
    this._log.deprecated('LocalParticipant#removeTracks has been deprecated. '
      + 'Use LocalParticipant#unpublishTracks instead.');
    stop = typeof stop === 'boolean' ? stop : true;
    return this.unpublishTracks(tracks).map(publication => {
      const track = publication.track;
      if (stop && track.kind !== 'data') {
        track.stop();
      }
      return track;
    });
  }

  /**
   * Sets the {@link NetworkQualityVerbosity} for the {@link LocalParticipant} and
   * {@link RemoteParticipant}s. It does nothing if Network Quality is not enabled
   * while calling {@link connect}.
   * @param {NetworkQualityConfiguration} networkQualityConfiguration - The new
   *   {@link NetworkQualityConfiguration}; If either or both of the local and
   *   remote {@link NetworkQualityVerbosity} values are absent, then the corresponding
   *   existing values are retained
   * @returns {this}
   * @example
   * // Update verbosity levels for both LocalParticipant and RemoteParticipants
   * localParticipant.setNetworkQualityConfiguration({
   *   local: 1,
   *   remote: 2
   * });
   * @example
   * // Update verbosity level for only the LocalParticipant
   * localParticipant.setNetworkQualityConfiguration({
   *   local: 1
   * });
   *  @example
   * // Update verbosity level for only the RemoteParticipants
   * localParticipant.setNetworkQualityConfiguration({
   *   remote: 2
   * });
   */
  setNetworkQualityConfiguration(networkQualityConfiguration) {
    if (typeof networkQualityConfiguration !== 'object'
      || networkQualityConfiguration === null) {
      // eslint-disable-next-line new-cap
      throw E.INVALID_TYPE('networkQualityConfiguration', 'NetworkQualityConfiguration');
    }
    ['local', 'remote'].forEach(prop => {
      if (prop in networkQualityConfiguration && typeof networkQualityConfiguration[prop] !== 'number') {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE(`networkQualityConfiguration.${prop}`, 'number');
      }
    });
    this._signaling.setNetworkQualityConfiguration(networkQualityConfiguration);
    return this;
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
   * @fires Participant#trackRemoved
   * @throws {TypeError}
  */
  unpublishTrack(track) {
    util.validateLocalTrack(track, {
      LocalAudioTrack: this._LocalAudioTrack,
      LocalDataTrack: this._LocalDataTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    });

    const localTrack = this.tracks.get(track.id);
    if (!localTrack) {
      return null;
    }

    const trackSignaling = this._signaling.tracks.get(localTrack.id);
    trackSignaling.publishFailed(new Error(`The ${localTrack} was unpublished`));

    const localTrackPublication = getTrackPublication(this.trackPublications, localTrack);
    this._removeTrack(localTrack);
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
   * @fires Participant#trackRemoved
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
 * A {@link LocalTrack} was added by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was added
 * @event LocalParticipant#trackAdded
 * @deprecated If you are using this event to monitor {@link LocalTrack}s that
 *   are published to the {@link Room}, alternatively you can access the .tracks
 *   collection which contains the newly added {@link LocalTrack}s right after
 *   {@link LocalParticipant#publishTrack}(s) is called
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
 * A {@link LocalTrack} was removed by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was removed
 * @event LocalParticipant#trackRemoved
 * @deprecated If you are using this event to monitor {@link LocalTrack}s that
 *   are unpublished from the {@link Room}, alternatively you can monitor the
 *   return value of {@link LocalParticipant#unpublishTrack}(s), which is the
 *   removed {@link LocalTrack}(s)
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
 *   If not specified, retains the existing bitrate limit; A <code>null</code> or a
 *   <code>0</code> value removes any previously set bitrate limit; This value is set
 *   as a hint for variable bitrate codecs, but will not take effect for fixed bitrate
 *   codecs; Based on our tests, Chrome, Firefox and Safari support a bitrate range of
 *   12000 bps to 256000 bps for Opus codec; This parameter has no effect on iSAC, PCMU
 *   and PCMA codecs
 * @property {?number} [maxVideoBitrate] - Max outgoing video bitrate (bps);
 *   If not specified, retains the existing bitrate limit; A <code>null</code> or
 *   a <code>0</code> value removes any previously set bitrate limit; This value is
 *   set as a hint for variable bitrate codecs, but will not take effect for fixed
 *   bitrate codecs; Based on our tests, Chrome, Firefox and Safari all seem to support
 *   an average bitrate range of 20000 bps (20 kbps) to 8000000 bps (8 mbps) for a
 *   720p VideoTrack
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
