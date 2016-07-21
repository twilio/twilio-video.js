'use strict';

var AudioTrack = require('./media/track/audiotrack');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');
var VideoTrack = require('./media/track/videotrack');

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Room}.
 * @param {ParticipantSignaling} signaling
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
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(signaling, media) {
  if (!(this instanceof Participant)) {
    return new Participant(signaling, media);
  }
  EventEmitter.call(this);

  Object.defineProperties(this, {
    _signaling: {
      value: signaling
    },
    identity: {
      enumerable: true,
      value: signaling.identity
    },
    media: {
      enumerable: true,
      value: media
    },
    sid: {
      enumerable: true,
      value: signaling.sid
    },
    state: {
      enumerable: true,
      get: function() {
        return signaling.state;
      }
    }
  });

  handleSignalingEvents(this, signaling);
}

inherits(Participant, EventEmitter);

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
 * The {@link Participant} has connected.
 * @param {Participant} participant - The {@link Participant} that connected.
 * @event Participant#connected
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
 * One of the {@link Participant}'s {@link Track}s ended.
 * @param {Track} track - The {@link Track} that ended
 * @event Participant#trackEnded
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

function handleSignalingEvents(participant, signaling) {
  // Reemit Track events from Media.
  [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackEnded',
    'trackRemoved',
    'trackStarted'
  ].forEach(function(event) {
    participant.media.on(event, function() {
      var args = [].slice.call(arguments);
      args.unshift(event);
      participant.emit.apply(participant, args);
    });
  });

  // Listen for both trackAdded and mediaStreamTrackAdded events in order to
  // construct Tracks and add them to Media.
  var deferreds = new Map();

  function getOrCreateDeferred(id) {
    var deferred = deferreds.get(id);
    if (!deferred) {
      deferred = util.defer();
      deferreds.set(id, deferred);
    }
    return deferred;
  }

  function createTrack(signaling) {
    return getOrCreateDeferred(signaling.id).promise.then(function(createTrack) {
      return createTrack(signaling);
    });
  }

  function mediaStreamTrackAdded(mediaStreamTrack, mediaStream) {
    var Track = mediaStreamTrack.kind === 'audio' ? AudioTrack : VideoTrack;
    getOrCreateDeferred(mediaStreamTrack.id).resolve(function(signaling) {
      return new Track(mediaStream, mediaStreamTrack, signaling);
    });
  }

  function trackSignalingAdded(signaling) {
    createTrack(signaling).then(function(track) {
      participant.media._addTrack(track);
    });
  }

  function trackSignalingRemoved(signaling) {
    var track = participant.media.tracks.get(signaling.id);
    if (track) {
      participant.media._removeTrack(track);
    }
  }

  signaling.on('mediaStreamTrackAdded', mediaStreamTrackAdded);
  signaling.on('trackAdded', trackSignalingAdded);
  signaling.on('trackRemoved', trackSignalingRemoved);

  signaling.tracks.forEach(trackSignalingAdded);

  // Reemit state transition events from the ParticipantSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    participant.emit(state, participant);
    if (state === 'ended') {
      signaling.removeListener('stateChanged', stateChanged);
      signaling.removeListener('mediaStreamTrackAdded', mediaStreamTrackAdded);
      signaling.removeListener('trackAdded', trackSignalingAdded);
      signaling.removeListener('trackRemoved', trackSignalingRemoved);
      deferreds.clear();
    }
  });
}

module.exports = Participant;
