'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Map = require('es6-map');
var Set = require('./util/set');
var util = require('./util');

// Participant maintains a map of addresses to Participants (and Endpoints).
var registry = new Map();

/**
 * Constructs a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} is any local or remote {@link Endpoint}
 * participating in zero-or-more {@link Session}s. {@link Participant}s are
 * identified by their addresses.
 * <br><br>
 * You should not call {@link Participant}'s constructor directly. Instead,
 * refer to the <code>participants</code> property on {@link Session}.
 * @param {string} address - the {@link Participant}'s address
 * @param {?Set<Session>} sessions - the {@link Session}s this
 *   {@link Participant} is initially active in
 * @property {string} address - the {@link Participant}'s address
 * @property {Set<Session>} sessions - the {@link Session}s this {@link
 *   Participant} is active in
 * @property {Map<Session, Array<Stream>>} streams - a Map from
 *   {@link Session}s to audio, video, or data {@link Stream}s offered by this
 *   {@link Participant}
 */
function Participant(address, sessions) {
  EventEmitter.call(this);

  sessions = sessions || new Set();
  var streams = new Map();
  sessions.forEach(function(session) {
    streams.set(session, new Set());
  });

  if (!this._uuid) {
    Object.defineProperty(this, '_uuid', {
      value: util.makeUUID()
    });
  }

  Object.defineProperties(this, {
    'address': {
      value: address
    },
    'sessions': {
      value: sessions
    },
    'streams': {
      value: streams
    }
  });

  if (!this._log) {
    Log.mixin.call(this, this.toString());
  }

  registry.set(address, this);
  return this;
}

inherits(Participant, EventEmitter);

// NOTE(mroberts): The following aren't going into JSDoc until I figure out
// how to mark public/private.

Participant._reset = function _reset() {
  registry.clear();
  return Participant;
};

/*
 * Get an existing {@link Participant} by address.
 * @param {string} address -the {@link Participant} address
 * @returns {?Participant}
 */
Participant._get = function _get(address) {
  return registry.get(address) || null;
};

/*
 * Get an existing {@link Participant} by address, or create it if not present.
 * @param {string} address - the {@link Participant} address
 * @returns {?Participant}
 */
Participant._getOrCreate = function _getOrCreate(address) {
  var participant = Participant._get(address);
  if (!participant) {
    participant = new Participant(address);
    registry.set(address, participant);
  }
  return participant;
};

/*
 * Delete a {@link Participant}, preventing future lookup.
 * @param {Participant} participant
 * @returns {?Participant}
 */
Participant._delete = function _delete(participant) {
  var address = participant.address;
  if (Participant._get(address)) {
    registry.delete(address);
  }
  return participant;
};

Participant.prototype.toString = function toString() {
  return '[Participant ' + this.address + ']';
};

module.exports = Participant;
