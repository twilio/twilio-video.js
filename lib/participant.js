'use strict';

var RemoteAudioTrack = require('./media/track/remoteaudiotrack');
var RemoteVideoTrack = require('./media/track/remotevideotrack');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');
var nInstances = 0;

/**
 * Construct a {@link Participant}.
 * @class
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.ID, RemoteAudioTrack>} audioTracks - The {@link Participant}'s {@link RemoteAudioTrack}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
 * @property {Map<Track.ID, RemoteTrack>} tracks - The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.ID, RemoteVideoTrack>} videoTracks - The {@link Participant}'s {@link RemoteVideoTrack}s.
 * @fires Participant#connected
 * @fires Participant#disconnected
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(signaling, options) {
  EventEmitter.call(this);

  options = Object.assign({
    RemoteAudioTrack: RemoteAudioTrack,
    RemoteVideoTrack: RemoteVideoTrack,
    tracks: []
  }, options);

  var indexed = indexTracksById(options.tracks);
  var log = options.log.createLog('default', this);
  var audioTracks = new Map(indexed.audioTracks);
  var tracks = new Map(indexed.tracks);
  var videoTracks = new Map(indexed.videoTracks);

  Object.defineProperties(this, {
    _RemoteAudioTrack: {
      value: options.RemoteAudioTrack
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
      get: function get() {
        log.warn('Participant#audioTracks has been deprecated. '
          + 'Use LocalParticipant#publishedAudioTracks or '
          + 'RemoteParticipant#subscribedAudioTracks instead');
        return audioTracks;
      }
    },
    identity: {
      enumerable: true,
      get: function() {
        return signaling.identity;
      }
    },
    sid: {
      enumerable: true,
      get: function() {
        return signaling.sid;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return signaling.state;
      }
    },
    tracks: {
      enumerable: true,
      get: function get() {
        log.warn('Participant#tracks has been deprecated. '
          + 'Use LocalParticipant#publishedTracks or '
          + 'RemoteParticipant#subscribedTracks instead');
        return tracks;
      }
    },
    videoTracks: {
      enumerable: true,
      get: function get() {
        log.warn('Participant#videoTracks has been deprecated. '
          + 'Use LocalParticipant#publishedVideoTracks or '
          + 'RemoteParticipant#subscribedVideoTracks instead');
        return videoTracks;
      }
    }
  });

  this.tracks.forEach(reemitTrackEvents.bind(null, this));
  reemitSignalingStateChangedEvents(this, signaling);
  this._handleTrackSignalingEvents();
  log.info('Created a new Participant' + (this.identity ? ': ' + this.identity : ''));
}

inherits(Participant, EventEmitter);

/**
 * Get the {@link RemoteTrack} events to re-emit.
 * @private
 * @returns {Array<Array<string>>} events
 */
Participant.prototype._getTrackEvents = function _getTrackEvents() {
  return [
    ['dimensionsChanged', 'trackDimensionsChanged'],
    ['disabled', 'trackDisabled'],
    ['enabled', 'trackEnabled'],
    ['started', 'trackStarted']
  ];
};

Participant.prototype.toString = function toString() {
  return '[Participant #' + this._instanceId + ': ' + this.sid + ']';
};

Participant.prototype._addTrack = function _addTrack(track) {
  var log = this._log;
  if (this.tracks.has(track.id)) {
    return null;
  }
  this.tracks.set(track.id, track);

  if (track.kind === 'audio') {
    this.audioTracks.set(track.id, track);
  } else {
    this.videoTracks.set(track.id, track);
  }
  reemitTrackEvents(this, track);

  log.info('Added a new ' + util.trackClass(track) + ':', track.id);
  log.debug(util.trackClass(track) + ':', track);
  this.emit('trackAdded', track);

  return track;
};

Participant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var log = this._log;
  var self = this;

  if (this.state === 'disconnected') {
    return;
  }

  var RemoteAudioTrack = this._RemoteAudioTrack;
  var RemoteVideoTrack = this._RemoteVideoTrack;
  var signaling = this._signaling;

  function trackSignalingAdded(signaling) {
    signaling.getMediaStreamTrack().then(function(mediaStreamTrack) {
      var RemoteTrack = signaling.kind === 'audio'
        ? RemoteAudioTrack
        : RemoteVideoTrack;
      var track = new RemoteTrack(mediaStreamTrack, signaling, { log: log });
      self._addTrack(track);
    });
  }

  function trackSignalingRemoved(signaling) {
    signaling.getMediaStreamTrack().then(function() {
      var track = self.tracks.get(signaling.id);
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
};

Participant.prototype._removeTrack = function _removeTrack(track) {
  if (!this.tracks.has(track.id)) {
    return null;
  }
  track = this.tracks.get(track.id);
  this.tracks.delete(track.id);

  var tracks = track.kind === 'audio' ? this.audioTracks : this.videoTracks;
  tracks.delete(track.id);

  var reemitters = this._trackEventReemitters.get(track.id) || new Map();
  reemitters.forEach(function(reemitter, event) {
    track.removeListener(event, reemitter);
  });

  var log = this._log;
  log.info('Removed a ' + util.trackClass(track) + ':', track.id);
  log.debug(util.trackClass(track) + ':', track);
  this.emit('trackRemoved', track);

  return track;
};

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
 * A {@link RemoteTrack} was added by the {@link Participant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event Participant#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by the {@link Participant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @event Participant#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by the {@link Participant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
 * @event Participant#trackEnabled
 */

/**
 * A {@link RemoteTrack} was removed by the {@link Participant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event Participant#trackRemoved
 */

/**
 * One of the {@link Participant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event Participant#trackStarted
 */

/**
 * Indexed {@link Track}s by {@link Track.ID}.
 * @typedef {object} IndexedTracks
 * @property {Array<{0: Track.ID, 1: AudioTrack}>} audioTracks - Indexed
 *   {@link AudioTrack}s
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
  var indexedTracks = tracks.map(function(track) {
    return [track.id, track];
  });
  var indexedAudioTracks = indexedTracks.filter(function(keyValue) {
    return keyValue[1].kind === 'audio';
  });
  var indexedVideoTracks = indexedTracks.filter(function(keyValue) {
    return keyValue[1].kind === 'video';
  });

  return {
    audioTracks: indexedAudioTracks,
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

      participant.tracks.forEach(function(track) {
        participant._trackEventReemitters.get(track.id)
          .forEach(function(reemitter, event) {
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
  var trackEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackEvents().forEach(function(eventPair) {
    var trackEvent = eventPair[0];
    var participantEvent = eventPair[1];

    trackEventReemitters.set(trackEvent, function() {
      var args = [participantEvent].concat([].slice.call(arguments));
      return participant.emit.apply(participant, args);
    });

    track.on(trackEvent, trackEventReemitters.get(trackEvent));
  });

  participant._trackEventReemitters.set(track.id, trackEventReemitters);
}

module.exports = Participant;
