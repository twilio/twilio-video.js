'use strict';

const RemoteAudioTrack = require('./media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('./media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('./media/track/remotedatatrack');
const RemoteDataTrackPublication = require('./media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('./media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('./media/track/remotevideotrackpublication');
const EventEmitter = require('events').EventEmitter;
const util = require('./util');

let nInstances = 0;

/**
 * {@link NetworkQualityLevel} is a value from 0–5, inclusive, representing the
 * quality of a network connection.
 * @typedef {number} NetworkQualityLevel
 */

/**
 * @extends EventEmitter
 * @property {Map<Track.ID, AudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link AudioTrack}s
 * @property {Map<Track.SID, AudioTrackPublication>} audioTrackPublications -
 *    The {@link Participant}'s {@link AudioTrackPublication}s
 * @property {Map<Track.ID, DataTrack>} dataTracks -
 *    The {@link Participant}'s {@link DataTrack}s
 * @property {Map<Track.SID, DataTrackPublication>} dataTrackPublications -
 *    The {@link Participant}'s {@link DataTrackPublication}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {?NetworkQualityLevel} networkQualityLevel - The
 *    {@link Participant}'s current {@link NetworkQualityLevel}, if any
 * @property {?NetworkQualityStats} networkQualityStats - The
 *    {@link Participant}'s current {@link NetworkQualityStats}, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
 * @property {Map<Track.ID, Track>} tracks -
 *    The {@link Participant}'s {@link Track}s
 * @property {Map<Track.SID, TrackPublication>} trackPublications -
 *    The {@link Participant}'s {@link TrackPublication}s
 * @property {Map<Track.ID, VideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link VideoTrack}s
 * @property {Map<Track.SID, VideoTrackPublication>} videoTrackPublications -
 *    The {@link Participant}'s {@link VideoTrackPublication}s
 * @emits Participant#disconnected
 * @emits Particiapnt#networkQualityLevelChanged
 * @emits Participant#trackAdded
 * @emits Participant#trackDimensionsChanged
 * @emits Participant#trackDisabled
 * @emits Participant#trackEnabled
 * @emits Participant#trackRemoved
 * @emits Participant#trackStarted
 */
class Participant extends EventEmitter {
  /**
   * Construct a {@link Participant}.
   * @param {ParticipantSignaling} signaling
   * @param {object} [options]
   */
  constructor(signaling, options) {
    super();

    options = Object.assign({
      RemoteAudioTrack,
      RemoteAudioTrackPublication,
      RemoteDataTrack,
      RemoteDataTrackPublication,
      RemoteVideoTrack,
      RemoteVideoTrackPublication,
      tracks: []
    }, options);

    const indexed = indexTracksById(options.tracks);
    const log = options.log.createLog('default', this);
    const audioTracks = new Map(indexed.audioTracks);
    const dataTracks = new Map(indexed.dataTracks);
    const tracks = new Map(indexed.tracks);
    const videoTracks = new Map(indexed.videoTracks);

    Object.defineProperties(this, {
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
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: log
      },
      _signaling: {
        value: signaling
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
      audioTracks: {
        enumerable: true,
        value: audioTracks
      },
      audioTrackPublications: {
        enumerable: true,
        value: new Map()
      },
      dataTracks: {
        enumerable: true,
        value: dataTracks
      },
      dataTrackPublications: {
        enumerable: true,
        value: new Map()
      },
      identity: {
        enumerable: true,
        get() {
          return signaling.identity;
        }
      },
      networkQualityLevel: {
        enumerable: true,
        get() {
          return signaling.networkQualityLevel;
        }
      },
      networkQualityStats: {
        enumerable: true,
        get() {
          return signaling.networkQualityStats;
        }
      },
      sid: {
        enumerable: true,
        get() {
          return signaling.sid;
        }
      },
      state: {
        enumerable: true,
        get() {
          return signaling.state;
        }
      },
      tracks: {
        enumerable: true,
        value: tracks
      },
      trackPublications: {
        enumerable: true,
        value: new Map()
      },
      videoTracks: {
        enumerable: true,
        value: videoTracks
      },
      videoTrackPublications: {
        enumerable: true,
        value: new Map()
      }
    });

    this.tracks.forEach(reemitTrackEvents.bind(null, this));
    signaling.on('networkQualityLevelChanged', () =>
      this.emit('networkQualityLevelChanged', this.networkQualityLevel,
        this.networkQualityStats &&
        (this.networkQualityStats.audio || this.networkQualityStats.video)
          ? this.networkQualityStats
          : null));
    reemitSignalingStateChangedEvents(this, signaling);
    log.info(`Created a new Participant${this.identity ? `: ${this.identity}` : ''}`);
  }

  /**
   * Get the {@link RemoteTrack} events to re-emit.
   * @private
   * @returns {Array<Array<string>>} events
   */
  _getTrackEvents() {
    return [
      ['dimensionsChanged', 'trackDimensionsChanged'],
      ['disabled', 'trackDisabled'],
      ['enabled', 'trackEnabled'],
      ['message', 'trackMessage'],
      ['started', 'trackStarted']
    ];
  }

  /**
   * @private
   */
  _getTrackPublicationEvents() {
    // NOTE(mmalavalli): 'trackDisabled' and 'trackEnabled' will be
    // re-emitted from the RemoteTrackPublication instead of RemoteTrack
    // in twilio-video.js@2.0.0 onwards.
    return [];
  }

  toString() {
    return `[Participant #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * @private
   * @param {RemoteTrack} track
   * @returns {?RemoteTrack}
   */
  _addTrack(track) {
    const log = this._log;
    if (this.tracks.has(track._id)) {
      return null;
    }
    this.tracks.set(track._id, track);

    const tracksByKind = {
      audio: this.audioTracks,
      video: this.videoTracks,
      data: this.dataTracks
    }[track.kind];
    tracksByKind.set(track._id, track);
    reemitTrackEvents(this, track);

    log.info(`Added a new ${util.trackClass(track)}:`, track._id);
    log.debug(`${util.trackClass(track)}:`, track);
    this.emit('trackAdded', track);

    return track;
  }


  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _addTrackPublication(publication) {
    const log = this._log;
    if (this.trackPublications.has(publication.trackSid)) {
      return null;
    }
    this.trackPublications.set(publication.trackSid, publication);

    const trackPublicationsByKind = {
      audio: this.audioTrackPublications,
      data: this.dataTrackPublications,
      video: this.videoTrackPublications
    }[publication.kind];
    trackPublicationsByKind.set(publication.trackSid, publication);
    reemitTrackPublicationEvents(this, publication);

    log.info(`Added a new ${util.trackPublicationClass(publication)}:`, publication.trackSid);
    log.debug(`${util.trackPublicationClass(publication)}:`, publication);
    return publication;
  }

  /**
   * @private
   */
  _handleTrackSignalingEvents() {
    const log = this._log;
    const self = this;

    if (this.state === 'disconnected') {
      return;
    }

    const RemoteAudioTrack = this._RemoteAudioTrack;
    const RemoteAudioTrackPublication = this._RemoteAudioTrackPublication;
    const RemoteVideoTrack = this._RemoteVideoTrack;
    const RemoteVideoTrackPublication = this._RemoteVideoTrackPublication;
    const RemoteDataTrack = this._RemoteDataTrack;
    const RemoteDataTrackPublication = this._RemoteDataTrackPublication;
    const signaling = this._signaling;

    function trackSignalingAdded(signaling) {
      const RemoteTrackPublication = {
        audio: RemoteAudioTrackPublication,
        data: RemoteDataTrackPublication,
        video: RemoteVideoTrackPublication
      }[signaling.kind];

      const publication = new RemoteTrackPublication(signaling, { log });
      self._addTrackPublication(publication);

      let isSubscribed = signaling.isSubscribed;
      if (isSubscribed) {
        trackSignalingSubscribed(signaling);
      }

      self._trackSignalingUpdatedEventCallbacks.set(signaling.sid, () => {
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
      const updated = self._trackSignalingUpdatedEventCallbacks.get(signaling.sid);
      if (updated) {
        signaling.removeListener('updated', updated);
        self._trackSignalingUpdatedEventCallbacks.delete(signaling.id);
      }
      const publication = self.trackPublications.get(signaling.sid);
      if (publication) {
        self._removeTrackPublication(publication);
      }
    }

    function trackSignalingSubscribed(signaling) {
      const RemoteTrack = {
        audio: RemoteAudioTrack,
        video: RemoteVideoTrack,
        data: RemoteDataTrack
      }[signaling.kind];

      const publication = self.trackPublications.get(signaling.sid);
      const trackReceiver = signaling.trackTransceiver;

      // NOTE(mroberts): It should never be the case that the TrackSignaling and
      // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
      // case, we handle it here.
      if (!RemoteTrack || signaling.kind !== trackReceiver.kind) {
        return;
      }

      const track = signaling.kind === 'data'
        ? new RemoteTrack(trackReceiver, { log, name: signaling.name })
        : new RemoteTrack(trackReceiver, signaling.isEnabled, { log, name: signaling.name });

      self._addTrack(track, publication);
    }

    function trackSignalingUnsubscribed(signaling) {
      const track = util.flatMap(self.tracks).find(track => track.sid === signaling.sid);
      const publication = self.trackPublications.get(signaling.sid);
      if (track) {
        self._removeTrack(track, publication);
      }
    }

    signaling.on('trackAdded', trackSignalingAdded);
    signaling.on('trackRemoved', trackSignalingRemoved);

    signaling.tracks.forEach(trackSignalingAdded);

    signaling.on('stateChanged', function stateChanged(state) {
      if (state === 'disconnected') {
        log.debug('Removing event listeners');
        signaling.removeListener('stateChanged', stateChanged);
        signaling.removeListener('trackAdded', trackSignalingAdded);
        signaling.removeListener('trackRemoved', trackSignalingRemoved);
      }
    });
  }

  /**
   * @private
   * @param {RemoteTrack} track
   */
  _deleteTrack(track) {
    this.tracks.delete(track._id);

    const tracksByKind = {
      audio: this.audioTracks,
      video: this.videoTracks,
      data: this.dataTracks
    }[track.kind];
    tracksByKind.delete(track._id);

    const reemitters = this._trackEventReemitters.get(track._id) || new Map();
    reemitters.forEach((reemitter, event) => {
      track.removeListener(event, reemitter);
    });

    const log = this._log;
    log.info(`Removed a ${util.trackClass(track)}:`, track._id);
    log.debug(`${util.trackClass(track)}:`, track);
  }

  /**
   * @private
   * @param {RemoteTrack} track
   * @returns {?RemoteTrack}
   */
  _removeTrack(track) {
    if (!this.tracks.has(track._id)) {
      return null;
    }
    track = this.tracks.get(track._id);
    this._deleteTrack(track);
    this.emit('trackRemoved', track);
    return track;
  }

  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _removeTrackPublication(publication) {
    publication = this.trackPublications.get(publication.trackSid);
    if (!publication) {
      return null;
    }
    this.trackPublications.delete(publication.trackSid);

    const trackPublicationsByKind = {
      audio: this.audioTrackPublications,
      data: this.dataTrackPublications,
      video: this.videoTrackPublications
    }[publication.kind];
    trackPublicationsByKind.delete(publication.trackSid);

    const reemitters = this._trackPublicationEventReemitters.get(publication.trackSid) || new Map();
    reemitters.forEach((reemitter, event) => {
      publication.removeListener(event, reemitter);
    });

    const log = this._log;
    log.info(`Removed a ${util.trackPublicationClass(publication)}:`, publication.trackSid);
    log.debug(`${util.trackPublicationClass(publication)}:`, publication);
    return publication;
  }
}

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
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 * @deprecated
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was disabled.
 * @event Participant#trackDisabled
 */

/**
 * A {@link Track} was enabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Participant#trackEnabled
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 * @deprecated
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
  const indexedTracks = tracks.map(track => [track._id, track]);
  const indexedAudioTracks = indexedTracks.filter(keyValue => keyValue[1].kind === 'audio');
  const indexedVideoTracks = indexedTracks.filter(keyValue => keyValue[1].kind === 'video');
  const indexedDataTracks = indexedTracks.filter(keyValue => keyValue[1].kind === 'data');

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
  const log = participant._log;

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

      participant.tracks.forEach(track => {
        participant._trackEventReemitters.get(track._id)
          .forEach((reemitter, event) => {
            track.removeListener(event, reemitter);
          });
      });
      participant._trackEventReemitters.clear();

      participant.trackPublications.forEach(publication => {
        participant._trackPublicationEventReemitters.get(publication.trackSid)
          .forEach((reemitter, event) => {
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
 * @private
 */
function reemitTrackEvents(participant, track) {
  const trackEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackEvents().forEach(eventPair => {
    const trackEvent = eventPair[0];
    const participantEvent = eventPair[1];

    trackEventReemitters.set(trackEvent, function() {
      const args = [participantEvent].concat([].slice.call(arguments));
      return participant.emit(...args);
    });

    track.on(trackEvent, trackEventReemitters.get(trackEvent));
  });

  participant._trackEventReemitters.set(track._id, trackEventReemitters);
}

/**
 * Re-emit {@link TrackPublication} events.
 * @private
 * @param {Participant} participant
 * @param {TrackPublication} publication
 */
function reemitTrackPublicationEvents(participant, publication) {
  const publicationEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackPublicationEvents().forEach(([publicationEvent, participantEvent]) => {
    publicationEventReemitters.set(publicationEvent, (...args) => {
      participant.emit(participantEvent, ...args, publication);
    });
    publication.on(publicationEvent, publicationEventReemitters.get(publicationEvent));
  });

  participant._trackPublicationEventReemitters.set(publication.trackSid, publicationEventReemitters);
}

module.exports = Participant;
