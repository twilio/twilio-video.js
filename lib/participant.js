'use strict';

var DefaultAudioTrack = require('./media/track/audiotrack');
var DefaultVideoTrack = require('./media/track/videotrack');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');
var nInstances = 0;

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Room}.
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.ID, AudioTrack>} audioTracks - The {@link Participant}'s {@link AudioTrack}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
 * @property {Map<Track.ID, Track>} tracks - The {@link Participant}'s {@link Track}s
 * @property {Map<Track.ID, VideoTrack>} videoTracks - The {@link Participant}'s {@link VideoTrack}s.
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
  if (!(this instanceof Participant)) {
    return new Participant(signaling, options);
  }
  EventEmitter.call(this);

  options = Object.assign({
    AudioTrack: DefaultAudioTrack,
    VideoTrack: DefaultVideoTrack,
    tracks: []
  }, options);

  var indexed = indexTracksById(options.tracks);
  Object.defineProperties(this, {
    _AudioTrack: {
      value: options.AudioTrack
    },
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: options.log.createLog('default', this)
    },
    _signaling: {
      value: signaling
    },
    _trackEventReemitters: {
      value: new Map()
    },
    _VideoTrack: {
      value: options.VideoTrack
    },
    audioTracks: {
      enumerable: true,
      value: new Map(indexed.audioTracks)
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
      value: new Map(indexed.tracks)
    },
    videoTracks: {
      enumerable: true,
      value: new Map(indexed.videoTracks)
    }
  });

  this.tracks.forEach(reemitTrackEvents.bind(null, this));
  reemitSignalingStateChangedEvents(this, signaling);
  this._handleTrackSignalingEvents();

  var log = this._log;
  log.info('Created a new Participant' + (this.identity ? ': ' + this.identity : ''));
}

inherits(Participant, EventEmitter);

/**
 * Get the {@link Track} events to re-emit.
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

  var AudioTrack = this._AudioTrack;
  var signaling = this._signaling;
  var VideoTrack = this._VideoTrack;

  function trackSignalingAdded(signaling) {
    signaling.getMediaStreamTrack().then(function(mediaStreamTrack) {
      var Track = signaling.kind === 'audio' ? AudioTrack : VideoTrack;
      var track = new Track(mediaStreamTrack, signaling, { log: log });
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
