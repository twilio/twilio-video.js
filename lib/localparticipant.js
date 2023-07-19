'use strict';

const { MediaStreamTrack } = require('./webrtc');
const { asLocalTrack, asLocalTrackPublication, trackClass } = require('./util');
const { typeErrors: E, trackPriority } = require('./util/constants');
const { validateLocalTrack } = require('./util/validate');

const {
  LocalAudioTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('./media/track/es5');

const LocalAudioTrackPublication = require('./media/track/localaudiotrackpublication');
const LocalDataTrackPublication = require('./media/track/localdatatrackpublication');
const LocalVideoTrackPublication = require('./media/track/localvideotrackpublication');
const Participant = require('./participant');

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
 * @property {string} signalingRegion - The geographical region of the
 *     signaling edge the {@link LocalParticipant} is connected to.
 *
 * @emits RemoteParticipant#reconnected
 * @emits RemoteParticipant#reconnecting
 * @emits LocalParticipant#trackDimensionsChanged
 * @emits LocalParticipant#trackDisabled
 * @emits LocalParticipant#trackEnabled
 * @emits LocalParticipant#trackPublicationFailed
 * @emits LocalParticipant#trackPublished
 * @emits LocalParticipant#trackStarted
 * @emits LocalParticipant#trackStopped
 * @emits LocalParticipant#trackWarning
 * @emits LocalParticipant#trackWarningsCleared
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
      _eventObserver: {
        value: options.eventObserver
      },
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
      },
      signalingRegion: {
        enumerable: true,
        get() {
          return signaling.signalingRegion;
        }
      }
    });

    this._handleTrackSignalingEvents();
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @param {Track.ID} id
   * @param {Track.Priority} priority
   * @returns {?LocalTrack}
   */
  _addTrack(track, id, priority) {
    const addedTrack = super._addTrack(track, id);
    if (addedTrack && this.state !== 'disconnected') {
      this._addLocalTrack(track, priority);
    }
    return addedTrack;
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @param {Track.Priority} priority
   * @returns {void}
   */
  _addLocalTrack(track, priority) {
    // check if track has noise cancellation enabled.
    const vendor = track.noiseCancellation?.vendor;
    this._signaling.addTrack(track._trackSender, track.name, priority, vendor);
    this._log.info(`Added a new ${trackClass(track, true)}:`, track.id);
    this._log.debug(`${trackClass(track, true)}:`, track);
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
      this._log.info(`Removed a ${trackClass(track, true)}:`, track.id);
      this._log.debug(`${trackClass(track, true)}:`, track);
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

    const localTrackDisabled = localTrack => {
      const trackSignaling = this._signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.disable();
        log.debug(`Disabled the ${trackClass(localTrack, true)}:`, localTrack.id);
      }
    };

    const localTrackEnabled = localTrack => {
      const trackSignaling = this._signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.enable();
        log.debug(`Enabled the ${trackClass(localTrack, true)}:`, localTrack.id);
      }
    };

    const localTrackStopped = localTrack => {
      // NOTE(mroberts): We shouldn't need to check for `stop`, since DataTracks
      // do not emit "stopped".
      const trackSignaling = this._signaling.getPublication(localTrack._trackSender);
      if (trackSignaling) {
        trackSignaling.stop();
      }
      return trackSignaling;
    };

    const stateChanged = state => {
      log.debug('Transitioned to state:', state);
      if (state === 'disconnected') {
        log.debug('Removing LocalTrack event listeners');
        this._signaling.removeListener('stateChanged', stateChanged);
        this.removeListener('trackDisabled', localTrackDisabled);
        this.removeListener('trackEnabled', localTrackEnabled);
        this.removeListener('trackStopped', localTrackStopped);

        // NOTE(mmalavalli): Remove the stale MediaTrackSender clones so that we
        // do not call replaceTrack() on their RTCRtpSenders.
        this._tracks.forEach(track => {
          const trackSignaling = localTrackStopped(track);
          if (trackSignaling) {
            track._trackSender.removeClone(trackSignaling._trackTransceiver);
          }
        });

        log.info(`LocalParticipant disconnected. Stopping ${this._tracksToStop.size} automatically-acquired LocalTracks`);
        this._tracksToStop.forEach(track => {
          track.stop();
        });
      } else if (state === 'connected') {
        // NOTE(mmalavalli): Any transition to "connected" here is a result of
        // successful signaling reconnection, and not a first-time establishment
        // of the signaling connection.
        log.info('reconnected');

        // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
        // Do not signal  public events synchronously with lock held.
        setTimeout(() => this.emit('reconnected'), 0);
      }
    };

    this.on('trackDisabled', localTrackDisabled);
    this.on('trackEnabled', localTrackEnabled);
    this.on('trackStopped', localTrackStopped);

    this._signaling.on('stateChanged', stateChanged);

    this._tracks.forEach(track => {
      this._addLocalTrack(track, trackPriority.PRIORITY_STANDARD);
      this._getOrCreateLocalTrackPublication(track).catch(error => {
        // Just log a warning for now.
        log.warn(`Failed to get or create LocalTrackPublication for ${track}:`, error);
      });
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

    return new Promise((resolve, reject) => {
      function updated() {
        const error = trackSignaling.error;
        if (error) {
          trackSignaling.removeListener('updated', updated);
          log.warn(`Failed to publish the ${trackClass(localTrack, true)}: ${error.message}`);
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

        const warningHandler = twilioWarningName =>
          self.emit('trackWarning', twilioWarningName, localTrackPublication);

        const warningsClearedHandler = () =>
          self.emit('trackWarningsCleared', localTrackPublication);

        const unpublish = publication => {
          localTrackPublication.removeListener('trackWarning', warningHandler);
          localTrackPublication.removeListener('trackWarningsCleared', warningsClearedHandler);
          self.unpublishTrack(publication.track);
        };

        if (!localTrackPublication) {
          localTrackPublication = asLocalTrackPublication(localTrack, trackSignaling, unpublish, options);
          self._addTrackPublication(localTrackPublication);
        }

        localTrackPublication.on('warning', warningHandler);
        localTrackPublication.on('warningsCleared', warningsClearedHandler);

        const { state } = self._signaling;
        if (state === 'connected' || state === 'connecting') {
          if (localTrack._processorEventObserver) {
            localTrack._processorEventObserver.on('event', event => {
              self._eventObserver.emit('event', {
                name: event.name,
                payload: event.data,
                group: 'video-processor',
                level: 'info'
              });
            });
          }

          // NOTE(csantos): For tracks created before joining a room or already joined but about to publish it
          if (localTrack.processedTrack) {
            localTrack._captureFrames();
            localTrack._setSenderMediaStreamTrack(true);
          }
        }
        if (state === 'connected') {
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
   * @param {LocalTrackPublishOptions} [options] - The {@link LocalTrackPublishOptions}
   *   for publishing the {@link LocalTrack}
   * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
   *   {@link LocalTrackPublication} if successful; In a Large Group Room (Maximum
   *   Participants greater than 50), rejects with a {@link ParticipantMaxTracksExceededError}
   *   if either the total number of published Tracks in the Room exceeds 16, or the {@link LocalTrack}
   *   is part of a set of {@link LocalTrack}s which along with the published Tracks exceeds 16.
   * @throws {TypeError}
   * @throws {RangeError}
   * @example
   * var Video = require('twilio-video');
   *
   * Video.connect(token, {
   *   name: 'my-cool-room',
   *   audio: true
   * }).then(function(room) {
   *   return Video.createLocalVideoTrack({
   *     name: 'camera'
   *   }).then(function(localVideoTrack) {
   *     return room.localParticipant.publishTrack(localVideoTrack, {
   *       priority: 'high'
   *     });
   *   });
   * }).then(function(publication) {
   *   console.log('The LocalTrack "' + publication.trackName
   *     + '" was successfully published with priority "'
   *     * publication.priority + '"');
   * });
  *//**
   * Publishes a MediaStreamTrack to the {@link Room}.
   * @param {MediaStreamTrack} mediaStreamTrack - The MediaStreamTrack
   *   to publish; if a corresponding {@link LocalAudioTrack} or
   *   {@link LocalVideoTrack} has not yet been published, this method will
   *   construct one
   * @param {MediaStreamTrackPublishOptions} [options] - The options for publishing
   *   the MediaStreamTrack
   * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
   *   {@link LocalTrackPublication} if successful; In a Large Group Room (Maximum
   *   Participants greater than 50), rejects with a {@link ParticipantMaxTracksExceededError}
   *   if the total number of published Tracks in the Room exceeds 16, or the {@link LocalTrack}
   *   is part of a set of {@link LocalTrack}s which along with the published Tracks exceeds 16.
   * @throws {TypeError}
   * @throws {RangeError}
   * @example
   * var Video = require('twilio-video');
   *
   * Video.connect(token, {
   *   name: 'my-cool-room',
   *   audio: true
   * }).then(function(room) {
   *   return navigator.mediaDevices.getUserMedia({
   *     video: true
   *   }).then(function(mediaStream) {
   *     var mediaStreamTrack = mediaStream.getTracks()[0];
   *     return room.localParticipant.publishTrack(mediaStreamTrack, {
   *       name: 'camera',
   *       priority: 'high'
   *     });
   *   });
   * }).then(function(publication) {
   *   console.log('The LocalTrack "' + publication.trackName
   *     + '" was successfully published with priority "'
   *     * publication.priority + '"');
   * });
   */
  publishTrack(localTrackOrMediaStreamTrack, options) {
    const trackPublication = getTrackPublication(this.tracks, localTrackOrMediaStreamTrack);
    if (trackPublication) {
      return Promise.resolve(trackPublication);
    }

    options = Object.assign({
      log: this._log,
      priority: trackPriority.PRIORITY_STANDARD,
      LocalAudioTrack: this._LocalAudioTrack,
      LocalDataTrack: this._LocalDataTrack,
      LocalVideoTrack: this._LocalVideoTrack,
      MediaStreamTrack: this._MediaStreamTrack
    }, options);

    let localTrack;
    try {
      localTrack = asLocalTrack(localTrackOrMediaStreamTrack, options);
    } catch (error) {
      return Promise.reject(error);
    }

    const noiseCancellation = localTrack.noiseCancellation;
    const allowedAudioProcessors = this._signaling.audioProcessors;
    if (noiseCancellation && !allowedAudioProcessors.includes(noiseCancellation.vendor)) {
      this._log.warn(`${noiseCancellation.vendor} is not supported in this room. disabling it permanently`);
      noiseCancellation.disablePermanently();
    }

    const priorityValues = Object.values(trackPriority);
    if (!priorityValues.includes(options.priority)) {
      // eslint-disable-next-line new-cap
      return Promise.reject(E.INVALID_VALUE('LocalTrackPublishOptions.priority', priorityValues));
    }

    let addedLocalTrack = this._addTrack(localTrack, localTrack.id, options.priority)
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
   *   {@link LocalTrackPublication}s if successful; In a Large Group Room (Maximum
   *   Participants greater than 50), rejects with a {@link ParticipantMaxTracksExceededError}
   *   if the total number of published Tracks in the Room exceeds 16, or the {@link LocalTrack}s
   *   along with the published Tracks exceeds 16.
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

  setBandwidthProfile() {
    this._log.warn('setBandwidthProfile is not implemented yet and may be available in future versions of twilio-video.js');
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
      if (prop in networkQualityConfiguration && (typeof networkQualityConfiguration[prop] !== 'number' || isNaN(networkQualityConfiguration[prop]))) {
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
      if (this._signaling.getParameters().adaptiveSimulcast && encodingParameters.maxVideoBitrate) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE('encodingParameters', 'encodingParameters.maxVideoBitrate is not compatible with "preferredVideoCodecs=auto"');
      }

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
    validateLocalTrack(track, {
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
 * The {@link LocalParticipant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @event LocalParticipant#reconnected
 */

/**
 * The {@link LocalParticipant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @event LocalParticipant#reconnecting
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
 * information. In a Large Group Room (Maximum Participants greater than 50),
 * this event is raised with a {@link ParticipantMaxTracksExceededError} either
 * when attempting to publish the {@link LocalTrack} will exceed the Maximum Published
 * Tracks limit of 16, or the {@link LocalTrack} is part of a set of {@link LocalTrack}s
 * which along with the published Tracks exceeds 16.
 * @param {TwilioError} error - A {@link TwilioError} explaining why publication
 *   failed
 * @param {LocalTrack} localTrack - The {@link LocalTrack} that failed to
 *   publish
 * @event LocalParticipant#trackPublicationFailed
 */

/**
 * A {@link LocalTrack} that was added using {@link LocalParticipant#publishTrack} was successfully published. This event
 * is not raised for {@link LocalTrack}s added in {@link ConnectOptions}<code>.tracks</code> or auto-created within
 * <a href="module-twilio-video.html#.connect__anchor"><code>{@link connect}</code></a>.
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
 * One of the {@link LocalParticipant}'s {@link LocalTrackPublication}s encountered a warning.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @param {string} name - The warning that was raised.
 * @param {LocalTrackPublication} publication - The {@link LocalTrackPublication} that encountered the warning.
 * @event LocalParticipant#trackWarning
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrackPublication}s cleared all warnings.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @param {LocalTrackPublication} publication - The {@link LocalTrackPublication} that cleared all warnings.
 * @event LocalParticipant#trackWarningsCleared
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
 *   720p VideoTrack.
 *   Note: this limit is not applied for screen share tracks published on Chrome.
 */

/**
 * Options for publishing a {@link LocalTrack}.
 * @typedef {object} LocalTrackPublishOptions
 * @property {Track.Priority} [priority='standard'] - The priority with which the {@link LocalTrack}
 *   is to be published; In Group or Small Group Rooms, the appropriate bandwidth is
 *   allocated to the {@link LocalTrack} based on its {@link Track.Priority}; It has no
 *   effect in Peer-to-Peer Rooms; It defaults to "standard" when not provided
 */

/**
 * Options for publishing a {@link MediaStreamTrack}.
 * @typedef {LocalTrackOptions} MediaStreamTrackPublishOptions
 * @property {Track.Priority} [priority='standard'] - The priority with which the {@link LocalTrack}
 *   is to be published; In Group or Small Group Rooms, the appropriate bandwidth is
 *   allocated to the {@link LocalTrack} based on its {@link Track.Priority}; It has no
 *   effect in Peer-to-Peer Rooms; It defaults to "standard" when not provided
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
