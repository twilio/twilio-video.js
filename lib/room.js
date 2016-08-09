'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Participant = require('./participant');

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
 * @property {LocalParticipant} localParticipant - Your {@link Client}'s
 *   {@link LocalParticipant} in the {@link Room}.
 * @property {string} name - The {@link Room}'s name
 * @property {Map<Participant.SID, Participant>} participants - The {@link Participant}s
 *   participating in this {@link Room}
 * @property {Room.SID} sid - The {@link Room}'s SID
 * @property {string} state - "connected" or "disconnected"
 * @fires Room#disconnected
 * @fires Room#participantConnected
 * @fires Room#participantDisconnected
 * @fires Room#trackAdded
 * @fires Room#trackDimensionsChanged
 * @fires Room#trackDisabled
 * @fires Room#trackEnabled
 * @fires Room#trackEnded
 * @fires Room#trackRemoved
 * @fires Room#trackStarted
 */
function Room(localParticipant, signaling, options) {
  if (!(this instanceof Room)) {
    return new Room(localParticipant, signaling, options);
  }
  EventEmitter.call(this);

  options = Object.assign({
    logLevel: constants.DEFAULT_LOG_LEVEL
  }, options);

  var log = new Log('Room', options.logLevel);
  var participants = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _log: {
      value: log
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

  handleSignalingEvents(this, signaling);
}

inherits(Room, EventEmitter);

/**
 * Disconnect from the {@link Room}.
 * @returns {this}
 */
Room.prototype.disconnect = function disconnect() {
  this._signaling.disconnect();
  return this;
};

/**
 * A {@link Room.SID} is a 34-character string starting with "CV"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef Room.SID
 */

/**
 * Your {@link Client} was disconnected from the {@link Room} and all
 * other {@link Participant}s.
 * @param {Room} room - The {@link Room} your
 *   {@link Client} was disconnected from
 * @event Room#disconnected
 * @example
 * myRoom.on('disconnected', function() {
 *   myRoom.localParticipant.media.detach();
 * });
 */

/**
 * A {@link Participant} joined the {@link Room}.
 * @param {Participant} participant - The {@link Participant} who joined
 * @event Room#participantConnected
 * @example
 * myRoom.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Room');
 *
 *   // Get the participant's Media,
 *   var participantMedia = participant.media;
 *
 *   // And attach it to your application's view.
 *   var participantView = document.getElementById('participant-view');
 *   participantMedia.attach(participantView);
 *   participantVideos.appendChild(participantView);
 * });
 */

/**
 * A {@link Participant} left the {@link Room}.
 * @param {Participant} participant - The {@link Participant} who left
 * @event Room#participantDisconnected
 * @example
 * myRoom.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Room');
 * });
 */

/**
 * A {@link Track} was added by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was added
 * @param {Participant} participant - The {@link Participant} who added the
 *   {@link Track}
 * @event Room#trackAdded
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
 * One of a {@link Participant}'s {@link Track}s in the {@link Room} ended.
 * @param {Track} track - The {@link Track} that ended
 * @param {Participant} participant - The {@link Participant} whose {@link Track} ended
 * @event Room#trackEnded
 */

/**
 * A {@link Track} was removed by a {@link Participant} in the {@link Room}.
 * @param {Track} track - The {@link Track} that was removed
 * @param {Participant} participant - The {@link Participant} who removed the
 *   {@link Track}
 * @event Room#trackRemoved
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Room} started.
 * @param {Track} track - The {@link Track} that started
 * @param {Participant} participant - The {@link Participant} whose {@link Track} started
 * @event Room#trackStarted
 */

function connectParticipant(room, participantSignaling) {
  var participant = new Participant(participantSignaling);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track events from the Participant.
  var eventListeners = [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackEnded',
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
    room._participants.delete(participant.sid);
    eventListeners.forEach(function(args) {
      participant.removeListener(args[0], args[1]);
    });
    room.emit('participantDisconnected', participant);
  });
}

function handleSignalingEvents(room, signaling) {
  // Reemit Participant events from the RoomSignaling.
  signaling.participants.forEach(connectParticipant.bind(null, room));
  signaling.on('participantConnected', connectParticipant.bind(null, room));

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    room.emit(state, room);
    if (state === 'disconnected' &&
      room._options.shouldStopLocalMedia) {
      room.localParticipant.media.stop();
    }
  });
}

module.exports = Room;
