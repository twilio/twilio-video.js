'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc'),
    MediaStreamTrack = _require.MediaStreamTrack;

var _require2 = require('./util'),
    asLocalTrack = _require2.asLocalTrack,
    asLocalTrackPublication = _require2.asLocalTrackPublication,
    trackClass = _require2.trackClass;

var _require3 = require('./util/constants'),
    E = _require3.typeErrors,
    trackPriority = _require3.trackPriority;

var _require4 = require('./util/validate'),
    validateLocalTrack = _require4.validateLocalTrack;

var _require5 = require('./media/track/es5'),
    LocalAudioTrack = _require5.LocalAudioTrack,
    LocalDataTrack = _require5.LocalDataTrack,
    LocalVideoTrack = _require5.LocalVideoTrack;

var LocalAudioTrackPublication = require('./media/track/localaudiotrackpublication');
var LocalDataTrackPublication = require('./media/track/localdatatrackpublication');
var LocalVideoTrackPublication = require('./media/track/localvideotrackpublication');
var Participant = require('./participant');

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
 * @emits RemoteParticipant#reconnected
 * @emits RemoteParticipant#reconnecting
 * @emits LocalParticipant#trackDimensionsChanged
 * @emits LocalParticipant#trackDisabled
 * @emits LocalParticipant#trackEnabled
 * @emits LocalParticipant#trackPublicationFailed
 * @emits LocalParticipant#trackPublished
 * @emits LocalParticipant#trackStarted
 * @emits LocalParticipant#trackStopped
 */

var LocalParticipant = function (_Participant) {
  _inherits(LocalParticipant, _Participant);

  /**
   * Construct a {@link LocalParticipant}.
   * @param {ParticipantSignaling} signaling
   * @param {Array<LocalTrack>} localTracks
   * @param {Object} options
   */
  function LocalParticipant(signaling, localTracks, options) {
    _classCallCheck(this, LocalParticipant);

    options = Object.assign({
      LocalAudioTrack: LocalAudioTrack,
      LocalVideoTrack: LocalVideoTrack,
      LocalDataTrack: LocalDataTrack,
      MediaStreamTrack: MediaStreamTrack,
      LocalAudioTrackPublication: LocalAudioTrackPublication,
      LocalVideoTrackPublication: LocalVideoTrackPublication,
      LocalDataTrackPublication: LocalDataTrackPublication,
      shouldStopLocalTracks: false,
      tracks: localTracks
    }, options);

    var tracksToStop = options.shouldStopLocalTracks ? new Set(localTracks.filter(function (localTrack) {
      return localTrack.kind !== 'data';
    })) : new Set();

    var _this = _possibleConstructorReturn(this, (LocalParticipant.__proto__ || Object.getPrototypeOf(LocalParticipant)).call(this, signaling, options));

    Object.defineProperties(_this, {
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

    _this._handleTrackSignalingEvents();
    return _this;
  }

  /**
   * @private
   * @param {LocalTrack} track
   * @param {Track.ID} id
   * @param {Track.Priority} priority
   * @returns {?LocalTrack}
   */


  _createClass(LocalParticipant, [{
    key: '_addTrack',
    value: function _addTrack(track, id, priority) {
      var addedTrack = _get(LocalParticipant.prototype.__proto__ || Object.getPrototypeOf(LocalParticipant.prototype), '_addTrack', this).call(this, track, id);
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

  }, {
    key: '_addLocalTrack',
    value: function _addLocalTrack(track, priority) {
      this._signaling.addTrack(track._trackSender, track.name, priority);
      this._log.info('Added a new ' + trackClass(track, true) + ':', track.id);
      this._log.debug(trackClass(track, true) + ':', track);
    }

    /**
     * @private
     * @param {LocalTrack} track
     * @param {Track.ID} id
     * @returns {?LocalTrack}
     */

  }, {
    key: '_removeTrack',
    value: function _removeTrack(track, id) {
      var removedTrack = _get(LocalParticipant.prototype.__proto__ || Object.getPrototypeOf(LocalParticipant.prototype), '_removeTrack', this).call(this, track, id);
      if (removedTrack && this.state !== 'disconnected') {
        this._signaling.removeTrack(track._trackSender);
        this._log.info('Removed a ' + trackClass(track, true) + ':', track.id);
        this._log.debug(trackClass(track, true) + ':', track);
      }
      return removedTrack;
    }

    /**
     * Get the {@link LocalTrack} events to re-emit.
     * @private
     * @returns {Array<Array<string>>} events
     */

  }, {
    key: '_getTrackEvents',
    value: function _getTrackEvents() {
      return _get(LocalParticipant.prototype.__proto__ || Object.getPrototypeOf(LocalParticipant.prototype), '_getTrackEvents', this).call(this).concat([['disabled', 'trackDisabled'], ['enabled', 'trackEnabled'], ['stopped', 'trackStopped']]);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[LocalParticipant #' + this._instanceId + (this.sid ? ': ' + this.sid : '') + ']';
    }

    /**
     * @private
     */

  }, {
    key: '_handleTrackSignalingEvents',
    value: function _handleTrackSignalingEvents() {
      var _this2 = this;

      var log = this._log;

      if (this.state === 'disconnected') {
        return;
      }

      var signaling = this._signaling;

      function localTrackDisabled(localTrack) {
        var trackSignaling = signaling.getPublication(localTrack._trackSender);
        if (trackSignaling) {
          trackSignaling.disable();
          log.debug('Disabled the ' + trackClass(localTrack, true) + ':', localTrack.id);
        }
      }

      function localTrackEnabled(localTrack) {
        var trackSignaling = signaling.getPublication(localTrack._trackSender);
        if (trackSignaling) {
          trackSignaling.enable();
          log.debug('Enabled the ' + trackClass(localTrack, true) + ':', localTrack.id);
        }
      }

      function localTrackStopped(localTrack) {
        // NOTE(mroberts): We shouldn't need to check for `stop`, since DataTracks
        // do not emit "stopped".
        var trackSignaling = signaling.getPublication(localTrack._trackSender);
        if (trackSignaling) {
          trackSignaling.stop();
        }
      }

      this.on('trackDisabled', localTrackDisabled);
      this.on('trackEnabled', localTrackEnabled);
      this.on('trackStopped', localTrackStopped);

      this._tracks.forEach(function (track) {
        _this2._addLocalTrack(track, trackPriority.PRIORITY_STANDARD);
        _this2._getOrCreateLocalTrackPublication(track).catch(function (error) {
          // Just log a warning for now.
          log.warn('Failed to get or create LocalTrackPublication for ' + track + ':', error);
        });
      });

      var self = this;
      signaling.on('stateChanged', function stateChanged(state) {
        log.debug('Transitioned to state:', state);
        if (state === 'disconnected') {
          log.debug('Removing LocalTrack event listeners');
          signaling.removeListener('stateChanged', stateChanged);
          self.removeListener('trackDisabled', localTrackDisabled);
          self.removeListener('trackEnabled', localTrackEnabled);
          self.removeListener('trackStopped', localTrackStopped);
          self._tracks.forEach(localTrackStopped);

          log.info('LocalParticipant disconnected. Stopping ' + self._tracksToStop.size + ' automatically-acquired LocalTracks');
          self._tracksToStop.forEach(function (track) {
            track.stop();
          });
        } else if (state === 'connected') {
          // NOTE(mmalavalli): Any transition to "connected" here is a result of
          // successful signaling reconnection, and not a first-time establishment
          // of the signaling connection.
          log.info('reconnected');
          self.emit('reconnected');
        }
      });
    }

    /**
     * @private
     * @param {LocalTrack} localTrack
     * @returns {Promise<LocalTrackPublication>}
     */

  }, {
    key: '_getOrCreateLocalTrackPublication',
    value: function _getOrCreateLocalTrackPublication(localTrack) {
      var localTrackPublication = getTrackPublication(this.tracks, localTrack);
      if (localTrackPublication) {
        return Promise.resolve(localTrackPublication);
      }

      var log = this._log;
      var self = this;

      var trackSignaling = this._signaling.getPublication(localTrack._trackSender);
      if (!trackSignaling) {
        return Promise.reject(new Error('Unexpected error: The ' + localTrack + ' cannot be published'));
      }

      function unpublish(publication) {
        self.unpublishTrack(publication.track);
      }

      return new Promise(function (resolve, reject) {
        function updated() {
          var error = trackSignaling.error;
          if (error) {
            trackSignaling.removeListener('updated', updated);
            log.warn('Failed to publish the ' + trackClass(localTrack, true) + ': ' + error.message);
            self._removeTrack(localTrack, localTrack.id);
            setTimeout(function () {
              self.emit('trackPublicationFailed', error, localTrack);
            });
            reject(error);
            return;
          }

          if (!self._tracks.has(localTrack.id)) {
            trackSignaling.removeListener('updated', updated);
            reject(new Error('The ' + localTrack + ' was unpublished'));
            return;
          }

          var sid = trackSignaling.sid;
          if (!sid) {
            return;
          }

          trackSignaling.removeListener('updated', updated);

          var options = {
            log: log,
            LocalAudioTrackPublication: self._LocalAudioTrackPublication,
            LocalDataTrackPublication: self._LocalDataTrackPublication,
            LocalVideoTrackPublication: self._LocalVideoTrackPublication
          };

          localTrackPublication = getTrackPublication(self.tracks, localTrack);

          if (!localTrackPublication) {
            localTrackPublication = asLocalTrackPublication(localTrack, trackSignaling, unpublish, options);
            self._addTrackPublication(localTrackPublication);
          }

          if (self._signaling.state === 'connected') {
            setTimeout(function () {
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
     *   {@link LocalTrackPublication} if successful
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
    */ /**
       * Publishes a MediaStreamTrack to the {@link Room}.
       * @param {MediaStreamTrack} mediaStreamTrack - The MediaStreamTrack
       *   to publish; if a corresponding {@link LocalAudioTrack} or
       *   {@link LocalVideoTrack} has not yet been published, this method will
       *   construct one
       * @param {MediaStreamTrackPublishOptions} [options] - The options for publishing
       *   the MediaStreamTrack
       * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
       *   {@link LocalTrackPublication} if successful
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

  }, {
    key: 'publishTrack',
    value: function publishTrack(localTrackOrMediaStreamTrack, options) {
      var trackPublication = getTrackPublication(this.tracks, localTrackOrMediaStreamTrack);
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

      var localTrack = void 0;
      try {
        localTrack = asLocalTrack(localTrackOrMediaStreamTrack, options);
      } catch (error) {
        return Promise.reject(error);
      }

      var priorityValues = Object.values(trackPriority);
      if (!priorityValues.includes(options.priority)) {
        // eslint-disable-next-line new-cap
        return Promise.reject(E.INVALID_VALUE('LocalTrackPublishOptions.priority', priorityValues));
      }

      var addedLocalTrack = this._addTrack(localTrack, localTrack.id, options.priority) || this._tracks.get(localTrack.id);

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

  }, {
    key: 'publishTracks',
    value: function publishTracks(tracks) {
      if (!Array.isArray(tracks)) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE('tracks', 'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
      }
      return Promise.all(tracks.map(this.publishTrack, this));
    }
  }, {
    key: 'setBandwidthProfile',
    value: function setBandwidthProfile() {
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

  }, {
    key: 'setNetworkQualityConfiguration',
    value: function setNetworkQualityConfiguration(networkQualityConfiguration) {
      if ((typeof networkQualityConfiguration === 'undefined' ? 'undefined' : _typeof(networkQualityConfiguration)) !== 'object' || networkQualityConfiguration === null) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE('networkQualityConfiguration', 'NetworkQualityConfiguration');
      }
      ['local', 'remote'].forEach(function (prop) {
        if (prop in networkQualityConfiguration && (typeof networkQualityConfiguration[prop] !== 'number' || isNaN(networkQualityConfiguration[prop]))) {
          // eslint-disable-next-line new-cap
          throw E.INVALID_TYPE('networkQualityConfiguration.' + prop, 'number');
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

  }, {
    key: 'setParameters',
    value: function setParameters(encodingParameters) {
      if (typeof encodingParameters !== 'undefined' && (typeof encodingParameters === 'undefined' ? 'undefined' : _typeof(encodingParameters)) !== 'object') {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE('encodingParameters', 'EncodingParameters, null or undefined');
      }

      if (encodingParameters) {
        ['maxAudioBitrate', 'maxVideoBitrate'].forEach(function (prop) {
          if (typeof encodingParameters[prop] !== 'undefined' && typeof encodingParameters[prop] !== 'number' && encodingParameters[prop] !== null) {
            // eslint-disable-next-line new-cap
            throw E.INVALID_TYPE('encodingParameters.' + prop, 'number, null or undefined');
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

  }, {
    key: 'unpublishTrack',
    value: function unpublishTrack(track) {
      validateLocalTrack(track, {
        LocalAudioTrack: this._LocalAudioTrack,
        LocalDataTrack: this._LocalDataTrack,
        LocalVideoTrack: this._LocalVideoTrack,
        MediaStreamTrack: this._MediaStreamTrack
      });

      var localTrack = this._tracks.get(track.id);
      if (!localTrack) {
        return null;
      }

      var trackSignaling = this._signaling.getPublication(localTrack._trackSender);
      trackSignaling.publishFailed(new Error('The ' + localTrack + ' was unpublished'));

      localTrack = this._removeTrack(localTrack, localTrack.id);
      if (!localTrack) {
        return null;
      }

      var localTrackPublication = getTrackPublication(this.tracks, localTrack);
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

  }, {
    key: 'unpublishTracks',
    value: function unpublishTracks(tracks) {
      var _this3 = this;

      if (!Array.isArray(tracks)) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_TYPE('tracks', 'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
      }

      return tracks.reduce(function (unpublishedTracks, track) {
        var unpublishedTrack = _this3.unpublishTrack(track);
        return unpublishedTrack ? unpublishedTracks.concat(unpublishedTrack) : unpublishedTracks;
      }, []);
    }
  }]);

  return LocalParticipant;
}(Participant);

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
  return Array.from(trackPublications.values()).find(function (trackPublication) {
    return trackPublication.track === track || trackPublication.track.mediaStreamTrack === track;
  }) || null;
}

module.exports = LocalParticipant;