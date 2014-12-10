/**
 * @module Signal
 */
'use strict';

var Map = require('es6-map');
var Set = require('es6-set');

/**
 * Constructs a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} is any local or remote {@link Endpoint}
 * participating in zero-or-more {@link Session}s. {@link Participant}s are
 * identified by their addresses.
 * @param {string} address - the {@link Participant}'s address
 * @param {?Set<Session>} sessions - the {@link Session}s this
 *   {@link Participant} is initially active in
 * @property {string} address - the {@link Participant}'s address
 * @property {Set<Session>} sessions - the {@link Session}s this {@link
 *   Participant} is active in
 * @property {Map<Session, object>} streams - a Map from {@link Session}s to
 *   audio, video, or data streams offered by this {@link Participant}
 * @property {Set} allStreams - the set of all streams offered by this
 *   {@link Participant} across all {@link Session}s
 */
function Participant(address, sessions) {
  sessions = sessions || new Set();
  var streams = new Map();
  sessions.forEach(function(session) {
    streams.set(session, new Set());
  });

  Object.defineProperties(this, {
    // Public
    'address': {
      value: address
    },
    'allStreams': {
      get: function() {
        return new Set(this.streams.values());
      }
    },
    'sessions': {
      value: sessions
    },
    'streams': {
      value: streams
    }
  });
  return this;
}

module.exports = Participant;
