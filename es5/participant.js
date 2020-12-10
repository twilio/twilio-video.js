'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('./eventemitter');
var RemoteAudioTrack = require('./media/track/remoteaudiotrack');
var RemoteAudioTrackPublication = require('./media/track/remoteaudiotrackpublication');
var RemoteDataTrack = require('./media/track/remotedatatrack');
var RemoteDataTrackPublication = require('./media/track/remotedatatrackpublication');
var RemoteVideoTrack = require('./media/track/remotevideotrack');
var RemoteVideoTrackPublication = require('./media/track/remotevideotrackpublication');
var util = require('./util');

var nInstances = 0;

/**
 * {@link NetworkQualityLevel} is a value from 0–5, inclusive, representing the
 * quality of a network connection.
 * @typedef {number} NetworkQualityLevel
 */

/**
 * @extends EventEmitter
 * @property {Map<Track.SID, AudioTrackPublication>} audioTracks -
 *    The {@link Participant}'s {@link AudioTrackPublication}s
 * @property {Map<Track.SID, DataTrackPublication>} dataTracks -
 *    The {@link Participant}'s {@link DataTrackPublication}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {?NetworkQualityLevel} networkQualityLevel - The
 *    {@link Participant}'s current {@link NetworkQualityLevel}, if any
 * @property {?NetworkQualityStats} networkQualityStats - The
 *    {@link Participant}'s current {@link NetworkQualityStats}, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "reconnecting"
 * @property {Map<Track.SID, TrackPublication>} tracks -
 *    The {@link Participant}'s {@link TrackPublication}s
 * @property {Map<Track.SID, VideoTrackPublication>} videoTracks -
 *    The {@link Participant}'s {@link VideoTrackPublication}s
 * @emits Participant#disconnected
 * @emits Participant#networkQualityLevelChanged
 * @emits Participant#reconnected
 * @emits Participant#reconnecting
 * @emits Participant#trackDimensionsChanged
 * @emits Participant#trackStarted
 */

var Participant = function (_EventEmitter) {
  _inherits(Participant, _EventEmitter);

  /**
   * Construct a {@link Participant}.
   * @param {ParticipantSignaling} signaling
   * @param {object} [options]
   */
  function Participant(signaling, options) {
    _classCallCheck(this, Participant);

    var _this = _possibleConstructorReturn(this, (Participant.__proto__ || Object.getPrototypeOf(Participant)).call(this));

    options = Object.assign({
      RemoteAudioTrack: RemoteAudioTrack,
      RemoteAudioTrackPublication: RemoteAudioTrackPublication,
      RemoteDataTrack: RemoteDataTrack,
      RemoteDataTrackPublication: RemoteDataTrackPublication,
      RemoteVideoTrack: RemoteVideoTrack,
      RemoteVideoTrackPublication: RemoteVideoTrackPublication,
      tracks: []
    }, options);

    var indexed = indexTracksById(options.tracks);
    var log = options.log.createLog('default', _this);
    var audioTracks = new Map(indexed.audioTracks);
    var dataTracks = new Map(indexed.dataTracks);
    var tracks = new Map(indexed.tracks);
    var videoTracks = new Map(indexed.videoTracks);

    Object.defineProperties(_this, {
      _RemoteAudioTrack: {
        value: options.RemoteAudioTrack
      },
      _RemoteAudioTrackPublication: {
        value: options.RemoteAudioTrackPublication
      },
      _RemoteDataTrack: {
        value: options.RemoteDataTrack
      },
      _RemoteDataTrackPublication: {
        value: options.RemoteDataTrackPublication
      },
      _RemoteVideoTrack: {
        value: options.RemoteVideoTrack
      },
      _RemoteVideoTrackPublication: {
        value: options.RemoteVideoTrackPublication
      },
      _audioTracks: {
        value: audioTracks
      },
      _dataTracks: {
        value: dataTracks
      },
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: log
      },
      _signaling: {
        value: signaling
      },
      _tracks: {
        value: tracks
      },
      _trackEventReemitters: {
        value: new Map()
      },
      _trackPublicationEventReemitters: {
        value: new Map()
      },
      _trackSignalingUpdatedEventCallbacks: {
        value: new Map()
      },
      _videoTracks: {
        value: videoTracks
      },
      audioTracks: {
        enumerable: true,
        value: new Map()
      },
      dataTracks: {
        enumerable: true,
        value: new Map()
      },
      identity: {
        enumerable: true,
        get: function get() {
          return signaling.identity;
        }
      },
      networkQualityLevel: {
        enumerable: true,
        get: function get() {
          return signaling.networkQualityLevel;
        }
      },
      networkQualityStats: {
        enumerable: true,
        get: function get() {
          return signaling.networkQualityStats;
        }
      },
      sid: {
        enumerable: true,
        get: function get() {
          return signaling.sid;
        }
      },
      state: {
        enumerable: true,
        get: function get() {
          return signaling.state;
        }
      },
      tracks: {
        enumerable: true,
        value: new Map()
      },
      videoTracks: {
        enumerable: true,
        value: new Map()
      }
    });

    _this._tracks.forEach(reemitTrackEvents.bind(null, _this));
    signaling.on('networkQualityLevelChanged', function () {
      return _this.emit('networkQualityLevelChanged', _this.networkQualityLevel, _this.networkQualityStats && (_this.networkQualityStats.audio || _this.networkQualityStats.video) ? _this.networkQualityStats : null);
    });
    reemitSignalingStateChangedEvents(_this, signaling);
    log.info('Created a new Participant' + (_this.identity ? ': ' + _this.identity : ''));
    return _this;
  }

  /**
   * Get the {@link RemoteTrack} events to re-emit.
   * @private
   * @returns {Array<Array<string>>} events
   */


  _createClass(Participant, [{
    key: '_getTrackEvents',
    value: function _getTrackEvents() {
      return [['dimensionsChanged', 'trackDimensionsChanged'], ['message', 'trackMessage'], ['started', 'trackStarted']];
    }

    /**
     * @private
     */

  }, {
    key: '_getTrackPublicationEvents',
    value: function _getTrackPublicationEvents() {
      return [];
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[Participant #' + this._instanceId + ': ' + this.sid + ']';
    }

    /**
     * @private
     * @param {RemoteTrack} track
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_addTrack',
    value: function _addTrack(track, id) {
      var log = this._log;
      if (this._tracks.has(id)) {
        return null;
      }
      this._tracks.set(id, track);

      var tracksByKind = {
        audio: this._audioTracks,
        video: this._videoTracks,
        data: this._dataTracks
      }[track.kind];
      tracksByKind.set(id, track);
      reemitTrackEvents(this, track, id);

      log.info('Added a new ' + util.trackClass(track) + ':', id);
      log.debug(util.trackClass(track) + ':', track);

      return track;
    }

    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */

  }, {
    key: '_addTrackPublication',
    value: function _addTrackPublication(publication) {
      var log = this._log;
      if (this.tracks.has(publication.trackSid)) {
        return null;
      }
      this.tracks.set(publication.trackSid, publication);

      var trackPublicationsByKind = {
        audio: this.audioTracks,
        data: this.dataTracks,
        video: this.videoTracks
      }[publication.kind];
      trackPublicationsByKind.set(publication.trackSid, publication);
      reemitTrackPublicationEvents(this, publication);

      log.info('Added a new ' + util.trackPublicationClass(publication) + ':', publication.trackSid);
      log.debug(util.trackPublicationClass(publication) + ':', publication);
      return publication;
    }

    /**
     * @private
     */

  }, {
    key: '_handleTrackSignalingEvents',
    value: function _handleTrackSignalingEvents() {
      var log = this._log;
      var self = this;

      if (this.state === 'disconnected') {
        return;
      }

      var RemoteAudioTrack = this._RemoteAudioTrack;
      var RemoteAudioTrackPublication = this._RemoteAudioTrackPublication;
      var RemoteVideoTrack = this._RemoteVideoTrack;
      var RemoteVideoTrackPublication = this._RemoteVideoTrackPublication;
      var RemoteDataTrack = this._RemoteDataTrack;
      var RemoteDataTrackPublication = this._RemoteDataTrackPublication;
      var participantSignaling = this._signaling;

      function trackSignalingAdded(signaling) {
        var RemoteTrackPublication = {
          audio: RemoteAudioTrackPublication,
          data: RemoteDataTrackPublication,
          video: RemoteVideoTrackPublication
        }[signaling.kind];

        var publication = new RemoteTrackPublication(signaling, { log: log });
        self._addTrackPublication(publication);

        var isSubscribed = signaling.isSubscribed;
        if (isSubscribed) {
          trackSignalingSubscribed(signaling);
        }

        self._trackSignalingUpdatedEventCallbacks.set(signaling.sid, function () {
          if (isSubscribed !== signaling.isSubscribed) {
            isSubscribed = signaling.isSubscribed;
            if (isSubscribed) {
              trackSignalingSubscribed(signaling);
              return;
            }
            trackSignalingUnsubscribed(signaling);
          }
        });
        signaling.on('updated', self._trackSignalingUpdatedEventCallbacks.get(signaling.sid));
      }

      function trackSignalingRemoved(signaling) {
        if (signaling.isSubscribed) {
          signaling.setTrackTransceiver(null);
        }
        var updated = self._trackSignalingUpdatedEventCallbacks.get(signaling.sid);
        if (updated) {
          signaling.removeListener('updated', updated);
          self._trackSignalingUpdatedEventCallbacks.delete(signaling.sid);
        }
        var publication = self.tracks.get(signaling.sid);
        if (publication) {
          self._removeTrackPublication(publication);
        }
      }

      function trackSignalingSubscribed(signaling) {
        var isEnabled = signaling.isEnabled,
            name = signaling.name,
            kind = signaling.kind,
            sid = signaling.sid,
            trackTransceiver = signaling.trackTransceiver;

        var RemoteTrack = {
          audio: RemoteAudioTrack,
          video: RemoteVideoTrack,
          data: RemoteDataTrack
        }[kind];

        var publication = self.tracks.get(sid);

        // NOTE(mroberts): It should never be the case that the TrackSignaling and
        // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
        // case, we handle it here.
        if (!RemoteTrack || kind !== trackTransceiver.kind) {
          return;
        }

        var options = { log: log, name: name };
        var setPriority = function setPriority(newPriority) {
          return participantSignaling.updateSubscriberTrackPriority(sid, newPriority);
        };
        var track = kind === 'data' ? new RemoteTrack(sid, trackTransceiver, options) : new RemoteTrack(sid, trackTransceiver, isEnabled, setPriority, options);

        self._addTrack(track, publication, trackTransceiver.id);
      }

      function trackSignalingUnsubscribed(signaling) {
        var _Array$from$find = Array.from(self._tracks.entries()).find(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              track = _ref2[1];

          return track.sid === signaling.sid;
        }),
            _Array$from$find2 = _slicedToArray(_Array$from$find, 2),
            id = _Array$from$find2[0],
            track = _Array$from$find2[1];

        var publication = self.tracks.get(signaling.sid);
        if (track) {
          self._removeTrack(track, publication, id);
        }
      }

      participantSignaling.on('trackAdded', trackSignalingAdded);
      participantSignaling.on('trackRemoved', trackSignalingRemoved);

      participantSignaling.tracks.forEach(trackSignalingAdded);

      participantSignaling.on('stateChanged', function stateChanged(state) {
        if (state === 'disconnected') {
          log.debug('Removing event listeners');
          participantSignaling.removeListener('stateChanged', stateChanged);
          participantSignaling.removeListener('trackAdded', trackSignalingAdded);
          participantSignaling.removeListener('trackRemoved', trackSignalingRemoved);
        } else if (state === 'connected') {
          // NOTE(mmalavalli): Any transition to "connected" here is a result of
          // successful signaling reconnection, and not a first-time establishment
          // of the signaling connection.
          log.info('reconnected');

          // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
          // Do not signal  public events synchronously with lock held.
          setTimeout(function () {
            return self.emit('reconnected');
          }, 0);
        }
      });
    }

    /**
     * @private
     * @param {RemoteTrack} track
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_removeTrack',
    value: function _removeTrack(track, id) {
      if (!this._tracks.has(id)) {
        return null;
      }
      this._tracks.delete(id);

      var tracksByKind = {
        audio: this._audioTracks,
        video: this._videoTracks,
        data: this._dataTracks
      }[track.kind];
      tracksByKind.delete(id);

      var reemitters = this._trackEventReemitters.get(id) || new Map();
      reemitters.forEach(function (reemitter, event) {
        track.removeListener(event, reemitter);
      });

      var log = this._log;
      log.info('Removed a ' + util.trackClass(track) + ':', id);
      log.debug(util.trackClass(track) + ':', track);
      return track;
    }

    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */

  }, {
    key: '_removeTrackPublication',
    value: function _removeTrackPublication(publication) {
      publication = this.tracks.get(publication.trackSid);
      if (!publication) {
        return null;
      }
      this.tracks.delete(publication.trackSid);

      var trackPublicationsByKind = {
        audio: this.audioTracks,
        data: this.dataTracks,
        video: this.videoTracks
      }[publication.kind];
      trackPublicationsByKind.delete(publication.trackSid);

      var reemitters = this._trackPublicationEventReemitters.get(publication.trackSid) || new Map();
      reemitters.forEach(function (reemitter, event) {
        publication.removeListener(event, reemitter);
      });

      var log = this._log;
      log.info('Removed a ' + util.trackPublicationClass(publication) + ':', publication.trackSid);
      log.debug(util.trackPublicationClass(publication) + ':', publication);
      return publication;
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      return util.valueToJSON(this);
    }
  }]);

  return Participant;
}(EventEmitter);

/**
 * A {@link Participant.SID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Participant}.
 * @type string
 * @typedef Participant.SID
 */

/**
 * A {@link Participant.Identity} is a string that identifies a
 * {@link Participant}. You can think of it like a name.
 * @typedef {string} Participant.Identity
 */

/**
 * The {@link Participant} has disconnected.
 * @param {Participant} participant - The {@link Participant} that disconnected.
 * @event Participant#disconnected
 */

/**
 * The {@link Participant}'s {@link NetworkQualityLevel} changed.
 * @param {NetworkQualityLevel} networkQualityLevel - The new
 *   {@link NetworkQualityLevel}
 * @param {?NetworkQualityStats} networkQualityStats - The {@link NetworkQualityStats}
 *   based on which {@link NetworkQualityLevel} is calculated, if any
 * @event Participant#networkQualityLevelChanged
 */

/**
 * The {@link Participant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @event Participant#reconnected
 */

/**
 * The {@link Participant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @event Participant#reconnecting
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * One of the {@link Participant}'s {@link Track}s started.
 * @param {Track} track - The {@link Track} that started
 * @event Participant#trackStarted
 */

/**
 * Indexed {@link Track}s by {@link Track.ID}.
 * @typedef {object} IndexedTracks
 * @property {Array<{0: Track.ID, 1: AudioTrack}>} audioTracks - Indexed
 *   {@link AudioTrack}s
 * @property {Array<{0: Track.ID, 1: DataTrack}>} dataTracks - Indexed
 *   {@link DataTrack}s
 * @property {Array<{0: Track.ID, 1: Track}>} tracks - Indexed {@link Track}s
 * @property {Array<{0: Track.ID, 1: VideoTrack}>} videoTracks - Indexed
 *   {@link VideoTrack}s
 * @private
 */

/**
 * Index tracks by {@link Track.ID}.
 * @param {Array<Track>} tracks
 * @returns {IndexedTracks}
 * @private
 */


function indexTracksById(tracks) {
  var indexedTracks = tracks.map(function (track) {
    return [track.id, track];
  });
  var indexedAudioTracks = indexedTracks.filter(function (keyValue) {
    return keyValue[1].kind === 'audio';
  });
  var indexedVideoTracks = indexedTracks.filter(function (keyValue) {
    return keyValue[1].kind === 'video';
  });
  var indexedDataTracks = indexedTracks.filter(function (keyValue) {
    return keyValue[1].kind === 'data';
  });

  return {
    audioTracks: indexedAudioTracks,
    dataTracks: indexedDataTracks,
    tracks: indexedTracks,
    videoTracks: indexedVideoTracks
  };
}

/**
 * Re-emit {@link ParticipantSignaling} 'stateChanged' events.
 * @param {Participant} participant
 * @param {ParticipantSignaling} signaling
 * @private
 */
function reemitSignalingStateChangedEvents(participant, signaling) {
  var log = participant._log;

  if (participant.state === 'disconnected') {
    return;
  }

  // Reemit state transition events from the ParticipantSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    participant.emit(state, participant);
    if (state === 'disconnected') {
      log.debug('Removing Track event reemitters');
      signaling.removeListener('stateChanged', stateChanged);

      participant._tracks.forEach(function (track) {
        var reemitters = participant._trackEventReemitters.get(track.id);
        if (track && reemitters) {
          reemitters.forEach(function (reemitter, event) {
            track.removeListener(event, reemitter);
          });
        }
      });

      // TODO(joma): Removing this introduced unit test failures in the RemoteParticipant.
      // Investigate further before removing.
      signaling.tracks.forEach(function (trackSignaling) {
        var track = participant._tracks.get(trackSignaling.id);
        var reemitters = participant._trackEventReemitters.get(trackSignaling.id);
        if (track && reemitters) {
          reemitters.forEach(function (reemitter, event) {
            track.removeListener(event, reemitter);
          });
        }
      });

      participant._trackEventReemitters.clear();

      participant.tracks.forEach(function (publication) {
        participant._trackPublicationEventReemitters.get(publication.trackSid).forEach(function (reemitter, event) {
          publication.removeListener(event, reemitter);
        });
      });
      participant._trackPublicationEventReemitters.clear();
    }
  });
}

/**
 * Re-emit {@link Track} events.
 * @param {Participant} participant
 * @param {Track} track
 * @param {Track.ID} id
 * @private
 */
function reemitTrackEvents(participant, track, id) {
  var trackEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackEvents().forEach(function (eventPair) {
    var trackEvent = eventPair[0];
    var participantEvent = eventPair[1];

    trackEventReemitters.set(trackEvent, function () {
      var args = [participantEvent].concat([].slice.call(arguments));
      return participant.emit.apply(participant, _toConsumableArray(args));
    });

    track.on(trackEvent, trackEventReemitters.get(trackEvent));
  });

  participant._trackEventReemitters.set(id, trackEventReemitters);
}

/**
 * Re-emit {@link TrackPublication} events.
 * @private
 * @param {Participant} participant
 * @param {TrackPublication} publication
 */
function reemitTrackPublicationEvents(participant, publication) {
  var publicationEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackPublicationEvents().forEach(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        publicationEvent = _ref4[0],
        participantEvent = _ref4[1];

    publicationEventReemitters.set(publicationEvent, function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      participant.emit.apply(participant, [participantEvent].concat(args, [publication]));
    });
    publication.on(publicationEvent, publicationEventReemitters.get(publicationEvent));
  });

  participant._trackPublicationEventReemitters.set(publication.trackSid, publicationEventReemitters);
}

module.exports = Participant;