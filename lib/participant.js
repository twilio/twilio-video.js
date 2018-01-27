'use strict';

const RemoteAudioTrack = require('./media/track/remoteaudiotrack');
const RemoteDataTrack = require('./media/track/remotedatatrack');
const RemoteTrackPublication = require('./media/track/remotetrackpublication');
const RemoteVideoTrack = require('./media/track/remotevideotrack');
const EventEmitter = require('events').EventEmitter;
const util = require('./util');

let nInstances = 0;

/**
 * Construct a {@link Participant}.
 * @class
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.ID, AudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link AudioTrack}s.
 * @property {Map<Track.ID, DataTrack>} dataTracks -
 *    The {@link Participant}'s {@link DataTrack}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
 * @property {Map<Track.ID, Track>} tracks -
 *    The {@link Participant}'s {@link Track}s
 * @property {Map<Track.ID, VideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link VideoTrack}s.
 * @fires Participant#disconnected
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
class Participant extends EventEmitter {
  constructor(signaling, options) {
    super();

    options = Object.assign({
      RemoteAudioTrack,
      RemoteVideoTrack,
      RemoteDataTrack,
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
      _RemoteDataTrack: {
        value: options.RemoteDataTrack
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
      _RemoteVideoTrack: {
        value: options.RemoteVideoTrack
      },
      audioTracks: {
        enumerable: true,
        value: audioTracks
      },
      dataTracks: {
        enumerable: true,
        value: dataTracks
      },
      identity: {
        enumerable: true,
        get() {
          return signaling.identity;
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
      videoTracks: {
        enumerable: true,
        value: videoTracks
      }
    });

    this.tracks.forEach(reemitTrackEvents.bind(null, this));
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

  toString() {
    return `[Participant #${this._instanceId}: ${this.sid}]`;
  }

  _addTrack(track) {
    const log = this._log;
    if (this.tracks.has(track.id)) {
      return null;
    }
    this.tracks.set(track.id, track);

    const tracksByKind = {
      audio: this.audioTracks,
      video: this.videoTracks,
      data: this.dataTracks
    }[track.kind];
    tracksByKind.set(track.id, track);
    reemitTrackEvents(this, track);

    log.info(`Added a new ${util.trackClass(track)}:`, track.id);
    log.debug(`${util.trackClass(track)}:`, track);
    this.emit('trackAdded', track);

    return track;
  }

  _handleTrackSignalingEvents() {
    const log = this._log;
    const self = this;

    if (this.state === 'disconnected') {
      return;
    }

    const RemoteAudioTrack = this._RemoteAudioTrack;
    const RemoteVideoTrack = this._RemoteVideoTrack;
    const RemoteDataTrack = this._RemoteDataTrack;
    const signaling = this._signaling;

    function trackSignalingAdded(signaling) {
      function handleTrackSubscriptionFailed() {
        if (!signaling.error) {
          return;
        }
        signaling.removeListener('updated', handleTrackSubscriptionFailed);
        const remoteTrackPublication = new RemoteTrackPublication(
          signaling.kind,
          signaling.sid,
          signaling.name,
          { log });
        self._log.warn(`Failed to subscribe to Remote${util.capitalize(signaling.kind)}Track ${signaling.sid} with name "${signaling.name}": ${signaling.error.message}`);
        self.emit('trackSubscriptionFailed', signaling.error, remoteTrackPublication);
      }

      signaling.on('updated', handleTrackSubscriptionFailed);

      signaling.getTrackTransceiver().then(trackReceiver => {
        signaling.removeListener('updated', handleTrackSubscriptionFailed);

        const RemoteTrack = {
          audio: RemoteAudioTrack,
          video: RemoteVideoTrack,
          data: RemoteDataTrack
        }[signaling.kind];

        // NOTE(mroberts): It should never be the case that the TrackSignaling and
        // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
        // case, we handle it here.
        if (!RemoteTrack || signaling.kind !== trackReceiver.kind) {
          return;
        }

        const track = new RemoteTrack(trackReceiver, signaling, { log });
        self._addTrack(track);
      });
    }

    function trackSignalingRemoved(signaling) {
      signaling.getTrackTransceiver().then(() => {
        const track = self.tracks.get(signaling.id);
        if (track) {
          self._removeTrack(track);
        }
      });
    }

    signaling.on('trackAdded', trackSignalingAdded);
    signaling.on('trackRemoved', trackSignalingRemoved);

    signaling.tracks.forEach(trackSignalingAdded);

    signaling.on('stateChanged', function stateChanged(state) {
      if (state === 'disconnected') {
        log.debug('Removing TrackSignaling listeners');
        signaling.removeListener('stateChanged', stateChanged);
        signaling.removeListener('trackAdded', trackSignalingAdded);
        signaling.removeListener('trackRemoved', trackSignalingRemoved);
      }
    });
  }

  _deleteTrack(track) {
    this.tracks.delete(track.id);

    const tracksByKind = {
      audio: this.audioTracks,
      video: this.videoTracks,
      data: this.dataTracks
    }[track.kind];
    tracksByKind.delete(track.id);

    const reemitters = this._trackEventReemitters.get(track.id) || new Map();
    reemitters.forEach((reemitter, event) => {
      track.removeListener(event, reemitter);
    });

    const log = this._log;
    log.info(`Removed a ${util.trackClass(track)}:`, track.id);
    log.debug(`${util.trackClass(track)}:`, track);
  }

  _removeTrack(track) {
    if (!this.tracks.has(track.id)) {
      return null;
    }
    track = this.tracks.get(track.id);
    this._deleteTrack(track);
    this.emit('trackRemoved', track);
    return track;
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
 * @type string
 * @typedef Participant.Identity
 */

/**
 * The {@link Participant} has disconnected.
 * @param {Participant} participant - The {@link Participant} that disconnected.
 * @event Participant#disconnected
 */

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was disabled
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

      participant.tracks.forEach(track => {
        participant._trackEventReemitters.get(track.id)
          .forEach((reemitter, event) => {
            track.removeListener(event, reemitter);
          });
      });
      participant._trackEventReemitters.clear();
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

  participant._trackEventReemitters.set(track.id, trackEventReemitters);
}

module.exports = Participant;
