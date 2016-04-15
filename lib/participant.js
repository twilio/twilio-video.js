'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Conversation}.
 * @param {ParticipantImpl} impl
 * @property {string} identity - The identity of the {@link Participant}
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(impl) {
  if (!(this instanceof Participant)) {
    return new Participant(impl);
  }
  EventEmitter.call(this);

  Object.defineProperties(this, {
    _impl: {
      value: impl
    },
    identity: {
      enumerable: true,
      value: impl.identity
    },
    media: {
      enumerable: true,
      value: impl.media
    },
    sid: {
      enumerable: true,
      value: impl.sid
    }
  });

  handleImplEvents(this, impl);
}

inherits(Participant, EventEmitter);

/**
 * A {@link Participant.SID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Participant}.
 * @type string
 * @typedef Participant.SID
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

function handleImplEvents(participant, impl) {
  // Reemit Track events from the ParticipantImpl Media.
  [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackEnded',
    'trackRemoved',
    'trackStarted'
  ].forEach(function(event) {
    impl.media.on(event, function() {
      var args = [].slice.call(arguments);
      args.unshift(event);
      participant.emit.apply(participant, args);
    });
  });

  // Reemit state transition events from the ParticipantImpl.
  impl.on('stateChanged', function stateChanged(state) {
    participant.emit(state, participant);
  });
}

module.exports = Participant;
