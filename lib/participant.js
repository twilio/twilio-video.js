'use strict';

const EventEmitter = require('./eventemitter');
const RemoteAudioTrack = require('./media/track/remoteaudiotrack');
const RemoteAudioTrackPublication = require('./media/track/remoteaudiotrackpublication');
const RemoteDataTrack = require('./media/track/remotedatatrack');
const RemoteDataTrackPublication = require('./media/track/remotedatatrackpublication');
const RemoteVideoTrack = require('./media/track/remotevideotrack');
const RemoteVideoTrackPublication = require('./media/track/remotevideotrackpublication');
const util = require('./util');

let nInstances = 0;

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
        value: new Map()
      },
      videoTracks: {
        enumerable: true,
        value: new Map()
      }
    });

    this._tracks.forEach(reemitTrackEvents.bind(null, this));
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
      ['message', 'trackMessage'],
      ['started', 'trackStarted']
    ];
  }

  /**
   * @private
   */
  _getTrackPublicationEvents() {
    return [];
  }

  toString() {
    return `[Participant #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * @private
   * @param {RemoteTrack} track
   * @param {Track.ID} id
   * @returns {?RemoteTrack}
   */
  _addTrack(track, id) {
    const log = this._log;
    if (this._tracks.has(id)) {
      return null;
    }
    this._tracks.set(id, track);

    const tracksByKind = {
      audio: this._audioTracks,
      video: this._videoTracks,
      data: this._dataTracks
    }[track.kind];
    tracksByKind.set(id, track);
    reemitTrackEvents(this, track, id);

    log.info(`Added a new ${util.trackClass(track)}:`, id);
    log.debug(`${util.trackClass(track)}:`, track);

    return track;
  }


  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _addTrackPublication(publication) {
    const log = this._log;
    if (this.tracks.has(publication.trackSid)) {
      return null;
    }
    this.tracks.set(publication.trackSid, publication);

    const trackPublicationsByKind = {
      audio: this.audioTracks,
      data: this.dataTracks,
      video: this.videoTracks
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
    const participantSignaling = this._signaling;

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
        self._trackSignalingUpdatedEventCallbacks.delete(signaling.sid);
      }
      const publication = self.tracks.get(signaling.sid);
      if (publication) {
        self._removeTrackPublication(publication);
      }
    }

    function trackSignalingSubscribed(signaling) {
      const { isEnabled, name, kind, sid, trackTransceiver } = signaling;
      const RemoteTrack = {
        audio: RemoteAudioTrack,
        video: RemoteVideoTrack,
        data: RemoteDataTrack
      }[kind];

      const publication = self.tracks.get(sid);

      // NOTE(mroberts): It should never be the case that the TrackSignaling and
      // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
      // case, we handle it here.
      if (!RemoteTrack || kind !== trackTransceiver.kind) {
        return;
      }

      const options = { log, name };
      const setPriority = newPriority => participantSignaling.updateSubscriberTrackPriority(sid, newPriority);
      const track = kind === 'data'
        ? new RemoteTrack(sid, trackTransceiver, options)
        : new RemoteTrack(sid, trackTransceiver, isEnabled, setPriority, options);

      self._addTrack(track, publication, trackTransceiver.id);
    }

    function trackSignalingUnsubscribed(signaling) {
      const [id, track] = Array.from(self._tracks.entries()).find(([, track]) => track.sid === signaling.sid);
      const publication = self.tracks.get(signaling.sid);
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
        self.emit('reconnected');
      }
    });
  }

  /**
   * @private
   * @param {RemoteTrack} track
   * @param {Track.ID} id
   * @returns {?RemoteTrack}
   */
  _removeTrack(track, id) {
    if (!this._tracks.has(id)) {
      return null;
    }
    this._tracks.delete(id);

    const tracksByKind = {
      audio: this._audioTracks,
      video: this._videoTracks,
      data: this._dataTracks
    }[track.kind];
    tracksByKind.delete(id);

    const reemitters = this._trackEventReemitters.get(id) || new Map();
    reemitters.forEach((reemitter, event) => {
      track.removeListener(event, reemitter);
    });

    const log = this._log;
    log.info(`Removed a ${util.trackClass(track)}:`, id);
    log.debug(`${util.trackClass(track)}:`, track);
    return track;
  }

  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _removeTrackPublication(publication) {
    publication = this.tracks.get(publication.trackSid);
    if (!publication) {
      return null;
    }
    this.tracks.delete(publication.trackSid);

    const trackPublicationsByKind = {
      audio: this.audioTracks,
      data: this.dataTracks,
      video: this.videoTracks
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

  toJSON() {
    return util.valueToJSON(this);
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
  const indexedTracks = tracks.map(track => [track.id, track]);
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

      signaling.tracks.forEach(trackSignaling => {
        const track = participant._tracks.get(trackSignaling.id);
        const reemitters = participant._trackEventReemitters.get(trackSignaling.id);
        if (track && reemitters) {
          reemitters.forEach((reemitter, event) => {
            track.removeListener(event, reemitter);
          });
        }
      });
      participant._trackEventReemitters.clear();

      participant.tracks.forEach(publication => {
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
 * @param {Track.ID} id
 * @private
 */
function reemitTrackEvents(participant, track, id) {
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

  participant._trackEventReemitters.set(id, trackEventReemitters);
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
