'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
var nInstances = 0;

/**
 * Construct a {@link Room}.
 * @class
 * @classdesc A {@link Room} represents communication between your
 *   {@link Client} and one or more {@link Participant}s sharing
 *   {@link AudioTrack}s and {@link VideoTrack}s.
 *   <br><br>
 *   You can connect to a {@link Room} by calling {@link Client#connect}.
 * @param {RoomSignaling} signaling
 * @param {?object} [options={}]
 * @property {boolean} isRecording - Whether or not the {@link Room} is being
 *   recorded
 * @property {LocalParticipant} localParticipant - Your {@link Client}'s
 *   {@link LocalParticipant} in the {@link Room}.
 * @property {string} name - The {@link Room}'s name
 * @property {Map<Participant.SID, Participant>} participants - The {@link Participant}s
 *   participating in this {@link Room}
 * @property {Room.SID} sid - The {@link Room}'s SID
 * @property {string} state - "connected" or "disconnected"
 * @throws {SignalingConnectionDisconnectedError}
 * @fires Room#disconnected
 * @fires Room#participantConnected
 * @fires Room#participantDisconnected
 * @fires Room#recordingStarted
 * @fires Room#recordingStopped
 * @fires Room#trackAdded
 * @fires Room#trackDimensionsChanged
 * @fires Room#trackDisabled
 * @fires Room#trackEnabled
 * @fires Room#trackRemoved
 * @fires Room#trackStarted
 */
function Room(localParticipant, signaling, options) {
  if (!(this instanceof Room)) {
    return new Room(localParticipant, signaling, options);
  }
  EventEmitter.call(this);

  var log = options.log.createLog('default', this);
  var participants = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _log: {
      value: log
    },
    _instanceId: {
      value: ++nInstances
    },
    _options: {
      value: options
    },
    _participants: {
      value: participants
    },
    _signaling: {
      value: signaling
    },
    isRecording: {
      enumerable: true,
      get: function() {
        return signaling.recording.isEnabled || false;
      }
    },
    localParticipant: {
      enumerable: true,
      value: localParticipant
    },
    name: {
      enumerable: true,
      value: signaling.name
    },
    participants: {
      enumerable: true,
      value: participants
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

  handleRecordingEvents(this, signaling.recording);
  handleSignalingEvents(this, signaling);

  log.info('Created a new Room:', this.name);
  log.debug('Initial Participants:', Array.from(this._participants.values()));
}

inherits(Room, EventEmitter);

Room.prototype.toString = function toString() {
  return '[Room #' + this._instanceId + ': ' + this.sid + ']';
};

/**
 * Disconnect from the {@link Room}.
 * @returns {this}
 */
Room.prototype.disconnect = function disconnect() {
  this._log.info('Disconnecting');
  this._signaling.disconnect();
  return this;
};

/**
 * Get the {@link Room}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
Room.prototype.getStats = function getStats() {
  return this._signaling.getStats();
};

/**
 * A {@link Room.SID} is a 34-character string starting with "RM"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef Room.SID
 */

/**
 * Your {@link Client} was disconnected from the {@link Room} and all
 * other {@link Participant}s.
 * @param {Room} room - The {@link Room} your
 *   {@link Client} was disconnected from
 * @param {?TwilioError} error - Present when the {@link Client} got
 *   disconnected from the {@link Room} unexpectedly
 * @event Room#disconnected
 * @example
 * myRoom.on('disconnected', function(room, error) {
 *   if (error) {
 *     console.log('Unexpectedly disconnected:', error);
 *   }
 *   myRoom.localParticipant.tracks.forEach(function(track) {
 *     track.stop();
 *     track.detach();
 *   });
 * });
 */

/**
 * A {@link Participant} joined the {@link Room}.
 * @param {Participant} participant - The {@link Participant} who joined
 * @event Room#participantConnected
 * @example
 * myRoom.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Room');
 * });
 */

/**
 * A {@link Participant} left the {@link Room}.
 * @param {Participant} participant - The {@link Participant} who left
 * @event Room#participantDisconnected
 * @example
 * myRoom.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Room');
 *   participant.tracks.forEach(function(track) {
 *     track.detach().forEach(function(mediaElement) {
 *       mediaElement.remove();
 *     });
 *   });
 * });
 */

/**
 * The {@link Room} is now being recorded
 * @event Room#recordingStarted
 */

/**
 * The {@link Room} is no longer being recorded
 * @event Room#recordingStopped
 */

/**
 * A {@link Track} was added by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was added
 * @param {Participant} participant - The {@link Participant} who added the
 *   {@link Track}
 * @event Room#trackAdded
 * @example
 * room.on('trackAdded', function(track, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @param {Participant} participant - The {@link Participant} whose {@link VideoTrack}'s
 *   dimensions changed
 * @event Room#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was disabled
 * @param {Participant} participant - The {@link Participant} who disabled the
 *   {@link Track}
 * @event Room#trackDisabled
 */

/**
 * A {@link Track} was enabled by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was enabled
 * @param {Participant} participant - The {@link Participant} who enabled the
 *   {@link Track}
 * @event Room#trackEnabled
 */

/**
 * A {@link Track} was removed by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was removed
 * @param {Participant} participant - The {@link Participant} who removed the
 *   {@link Track}
 * @event Room#trackRemoved
 * @example
 * room.on('trackRemoved', function(track, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
 * });
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Room} started.
 * @param {Track} track - The {@link Track} that started
 * @param {Participant} participant - The {@link Participant} whose {@link Track} started
 * @event Room#trackStarted
 */

function connectParticipant(room, participantSignaling) {
  var log = room._log;
  var participant = new Participant(participantSignaling, { log: log });

  log.info('A new Participant connected:', participant);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track events from the Participant.
  var eventListeners = [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackRemoved',
    'trackStarted'
  ].map(function(event) {
    function reemit() {
      var args = [].slice.call(arguments);
      args.unshift(event);
      args.push(participant);
      room.emit.apply(room, args);
    }
    participant.on(event, reemit);
    return [event, reemit];
  });

  // Reemit state transition events from the Participant.
  participant.once('disconnected', function participantDisconnected() {
    log.info('Participant disconnected:', participant);
    room._participants.delete(participant.sid);
    eventListeners.forEach(function(args) {
      participant.removeListener(args[0], args[1]);
    });
    room.emit('participantDisconnected', participant);
  });
}

function handleRecordingEvents(room, recording) {
  recording.on('updated', function updated() {
    var started = recording.isEnabled;
    room._log.info('Recording ' + (started ? 'started' : 'stopped'));
    room.emit('recording' + (started ? 'Started' : 'Stopped'));
  });
}

function handleSignalingEvents(room, signaling) {
  var log = room._log;

  // Reemit Participant events from the RoomSignaling.
  log.debug('Creating a new Participant for each ParticipantSignaling '
    + 'in the RoomSignaling');
  signaling.participants.forEach(connectParticipant.bind(null, room));
  log.debug('Setting up Participant creation for all subsequent '
    + 'ParticipantSignalings that connect to the RoomSignaling');
  signaling.on('participantConnected', connectParticipant.bind(null, room));

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state, error) {
    log.info('Transitioned to state:', state);
    room.emit(state, room, error);
  });
}

module.exports = Room;
