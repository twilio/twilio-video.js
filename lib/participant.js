'use strict';

var DefaultAudioTrack = require('./media/track/audiotrack');
var DefaultVideoTrack = require('./media/track/videotrack');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');
var Media = require('./media');
var nInstances = 0;

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Room}.
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
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
    VideoTrack: DefaultVideoTrack
  }, options);

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
    _VideoTrack: {
      value: options.VideoTrack
    },
    identity: {
      enumerable: true,
      get: function() {
        return signaling.identity;
      }
    },
    media: {
      enumerable: true,
      value: options.media || new Media({ log: options.log })
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
    }
  });

  handleMediaAndSignalingEvents(this, signaling);
  this._handleTrackSignalingEvents();

  var log = this._log;
  log.info('Created a new Participant' + (this.identity ? ': ' + this.identity : ''));
  log.debug('Media:', this.media);
}

inherits(Participant, EventEmitter);

Participant.prototype.toString = function toString() {
  return '[Participant #' + this._instanceId + ': ' + this.sid + ']';
};

Participant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var log = this._log;

  if (this.state === 'disconnected') {
    return;
  }

  var AudioTrack = this._AudioTrack;
  var media = this.media;
  var signaling = this._signaling;
  var VideoTrack = this._VideoTrack;

  function trackSignalingAdded(signaling) {
    signaling.getMediaStreamTrack().then(function(pair) {
      var mediaStreamTrack = pair[0];
      var mediaStream = pair[1];
      var Track = signaling.kind === 'audio' ? AudioTrack : VideoTrack;
      var track = new Track(mediaStream, mediaStreamTrack, signaling, { log: log });
      media._addTrack(track);
      log.info('Added a new ' + util.trackClass(track) + ':', track.id);
      log.debug(util.trackClass(track) + ':', track);
    });
  }

  function trackSignalingRemoved(signaling) {
    signaling.getMediaStreamTrack().then(function() {
      var track = media.tracks.get(signaling.id);
      if (track) {
        media._removeTrack(track);
        log.info('Removed a ' + util.trackClass(track) + ':', track.id);
        log.debug(util.trackClass(track) + ':', track);
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

function handleMediaAndSignalingEvents(participant, signaling) {
  var log = participant._log;

  if (participant.state === 'disconnected') {
    return;
  }

  // Reemit Track events from Media.
  var removeListeners = [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackRemoved',
    'trackStarted'
  ].map(function(event) {
    function eventListener() {
      var args = [].slice.call(arguments);
      args.unshift(event);
      participant.emit.apply(participant, args);
    }
    participant.media.on(event, eventListener);
    return participant.media.removeListener.bind(participant.media, event, eventListener);
  });

  // Reemit state transition events from the ParticipantSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    participant.emit(state, participant);
    if (state === 'disconnected') {
      log.debug('Removing Track event reemitters');
      signaling.removeListener('stateChanged', stateChanged);
      removeListeners.forEach(function(removeListener) {
        removeListener();
      });
    }
  });
}

module.exports = Participant;
