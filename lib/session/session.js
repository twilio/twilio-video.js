'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Map = require('es6-map');
var Participant = require('../participant');

/**
 * Constructs a {@link Session}.
 * @class
 * @classdesc A {@link Session} represents a call from your {@link Endpoint}
 * to one or more other {@link Endpoint}s.
 * @param {Map<object, Participant>} sessions - a Map from SIP sessions to
 *   {@link Participant}s
 * @param {object} render - render options for audio and video
 * @property {Set<Participant>} participants - the set of {@link Participant}s
 *   in this {@link Session}
 */
function Session(sessions, render) {
  if (!(this instanceof Session)) {
    return new Session(sessions, render);
  }

  EventEmitter.call(this);

  // One-to-one map from Sessions to Participants
  var sessionToParticipant = new Map(sessions);

  // One-to-many map from Participants to Sessions
  var participantToSessions = new Map();
  sessionToParticipants.forEach(function(session, participant) {
    if (!participantToSessions.has(participant)) {
      participantToSession.set(participant, [session]);
    } else {
      participantToSession.get(participant).push(session);
    }
  });

  Object.defineProperties(this, {
    // Private
    _participantToSessions: {
      value: participantToSessions
    },
    _render: {
      value: render
    },
    _sessionToParticipant: {
      value: sessionToParticipant
    },
    // Public
    participants: {
      get: function() {
        return new Set(this._participantToSessions.keys());
      }
    }
  });

  return this;
}

inherits(Session, EventEmitter);

/**
 * Invites another {@link Participant} to join the {@link Session}.
 * @instance
 * @param {string} address - the address for the {@link Participant}, for
 *   example <code>alice@owl-123.twil.io</code>.
 * @returns {Session}
 */
Session.prototype.addParticipant = function addParticipant(address) {
  var present = false;
  this.participants.forEach(function(participant) {
    present = present || participant.address === address;
  });
  if (!present) {
    // TODO(mroberts): Handle SIP logic and add to maps.
  }
  return this;
};

/**
 * Removes a {@link Participant} from the {@link Session}.
 * @instance
 * @param {string|Participant} address - the address of the {@link Participant}
 *   or the {@link Participant} object for the party you would like to remove
 *   from the {@link Session}.
 * @returns {Session}
 */
Session.prototype.removeParticipant = function removeParticipant(address) {
  var present = false;
  var participant = null;
  if (address instanceof Participant) {
    participant = address;
    present = this.participants.has(participant);
  } else {
    this.participants.forEach(function(_participant) {
      if (!present && _participant.address === address) {
        present = true;
        participant = _participant;
      }
    });
  }
  if (present) {
    // TODO(mroberts): Handle SIP logic and delete from maps.
    var sessions = this._participantToSessions.get(participant);
    sessions.forEach(function(session) {
      this._sessionToParticipant.delete(session);
    }, this);
    this._participantToSessions.delete(participant);
  }
  return this;
};

module.exports = Session;
