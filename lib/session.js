'use strict';

var Endpoint = require('./endpoint');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Map = require('es6-map');
var Participant = require('./participant');
var Set = require('./util/set');
var util = require('./util');
var Q = require('q');

var PARTICIPANT_JOINED = 'participantJoined';
var PARTICIPANT_LEFT = 'participantLeft';

// Session maintains a map from Session SIDs to Sessions.
var registry = util.sessionRegistry;

// TODO(mroberts): Add real logging.
var console = {};
console.log = function log() {
  // global.console.log.apply(console, arguments);
};

/**
 * A {@link Participant} has joined the {@link Session}.
 * @event Session#participantJoined
 * @param {Participant} participant
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.createSession("bob@twil.io").then(function(session) {
 *   session.once('participantJoined', function(participant) {
 *     // Prints "bob@twil.io joined!"
 *     console.log(participant.address + ' joined!');
 *   });
 * });
 */

/**
 * A {@link Participant} has left the {@link Session}.
 * @event Session#participantLeft
 * @param {Participant} participant
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.createSession("bob@twil.io").then(function(session) {
 *   alice.leave(session);
 *   session.once('participantLeft', function(participant) {
 *     // Prints "alice@twil.io left!"
 *     console.log(participant.address + ' left!');
 *   });
 * });
 */

/**
 * Constructs a {@link Session}.
 * @class
 * @classdesc A {@link Session} represents a call from your {@link Endpoint}
 * to one or more other {@link Endpoint}s.
 * <br><br>
 * You should not call {@link Session}'s constructor directly; instead, use
 * {@link Endpoint#createSession}.
 * @param {?Endpoint} creator - the {@link Endpoint} responsible for creating
 *   this {@link Session}
 * @param {?Set<Participant>} participants - the set of {@link Participant}s
 *   invited to this {@link Session}
 * @param {?object} render - render options for audio and video
 * @param {?object} options
 * @property {Set<Participant>} participants - the set of {@link Participant}s
 *   active in this {@link Session}
 * @fires Session#participantJoined
 * @fires Session#participantLeft
 */
function Session(creator, _participants, render, options) {
  if (!(this instanceof Session)) {
    return new Session(creator, _participants, render, options);
  }

  options = util.withDefaults(options, {
  });

  EventEmitter.call(this);

  creator = creator || null;
  _participants = _participants || [];
  _participants =
    typeof _participants === 'string' || _participants instanceof Participant
      ? [_participants] : _participants;
  _participants = _participants.slice();
  if (creator) {
    _participants.unshift(creator);
  }
  var endpoints = new Set();
  var participants = new Set();

  Object.defineProperties(this, {
    // Private
    _creator: {
      value: creator
    },
    _endpoints: {
      value: endpoints
    },
    _participants: {
      value: participants
    },
    _render: {
      value: render
    },
    _uuid: {
      value: util.makeUUID()
    },
    // Public
    participants: {
      get: function() {
        var participants = new Set();
        [this._endpoints, this._participants].forEach(function(set) {
          set.forEach(participants.add.bind(participants));
        });
        return participants;
      }
    }
  });

  Log.mixin.call(this, '[Session ' + this._uuid + ']');

  // Session._add(this);
  var sessionSid = this._uuid;
  registry.set(sessionSid, this);

  this.invite(_participants);

  this._log.debug('Created');

  return Object.freeze(this);
}

inherits(Session, EventEmitter);

// NOTE(mroberts): The following aren't going into JSDoc until I figure out
// how to mark public/private.

Session._registry = registry;

Session._reset = function _reset() {
  registry.clear();
  return Session;
};

/*
 * Get an existing {@link Session} by SID.
 * @param {string} sessionSid - the {@link Session} SID
 * @returns {?Session}
 */
Session._get = function _get(sessionSid) {
  return registry.get(sessionSid) || null;
};

/*
 * Get an existing {@link Session} by SID, or create it if not present.
 * @param {string} sessionSid - the {@link Session} SID
 * @returns {Session}
 */
Session._getOrCreate = function _getOrCreate(sessionSid) {
  var session = Session._get(sessionSid);
  if (!session) {
    session = new Session();
    // FIXME(mroberts): Need to be able to set SID on Session.
    // Session._add(session);
    sessionSid = session._uuid;
    registry.set(sessionSid, session);
  }
  return session;
};

/*
 * Add a {@link Session} for future lookup.
 * @param {Session} session - the {@link Session}
 * @returns {Session}
 */
/* Session._add = function _add(session) {
  var sessionSid = session._uuid;
  registry.set(sessionSid, session);
  return Session;
}; */

/*
 * Delete a {@link Session}, preventing future lookup.
 * @param {Session}
 * @returns {?Session}
 */
Session._delete = function _delete(session) {
  var sessionSid = session._uuid;
  if (Session._get(sessionSid)) {
    registry.delete(sessionSid);
    return session;
  }
  return null;
};

// NOTE(mroberts): A lot to clean up down here.

Session.prototype.toString = function toString() {
  return '[Session ' + this._uuid + ']';
};

/**
 * Invites one-or-more {@link Participant}s to join the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - the
 *   {@link Participant} address to invite, for example
 *   <code>alice@owl-123.twil.io</code>
 * @returns {Promise<Session>}
 */
Session.prototype.invite = function invite(address) {
  var invitees = splitAddressesIntoEndpointsAndParticipants(address);

  var endpoints = this._endpoints;
  var allEndpoints = invitees.endpoints.slice();
  endpoints.forEach(function(endpoint) {
    allEndpoints.push(endpoint);
  });

  var participants = this._participants;
  var allParticipants = invitees.participants.slice();
  participants.forEach(function(participant) {
    allParticipants.push(participant);
  });

  var self = this;

  if (endpoints.size === 0 && invitees.endpoints.length === 1) {
    setTimeout(function() {
      var endpoint = invitees.endpoints[0];
      console.log('New Endpoint "' + endpoint.address + '" has joined');
      endpoints.add(endpoint);
      self._log.info('Participant joined', endpoint);
      self.emit(PARTICIPANT_JOINED, endpoint);
    });
  }

  // This keeps track of new, unINVITEed Endpoints (see below);
  var newEndpoints = util.tails(invitees.endpoints).slice(1);

  var endpointInvitations = invitees.endpoints
    .reduce(function(endpointInvitations, endpoint) {
      var invitations = [];
      // Each existing Endpoint INVITEs the new Endpoint.
      endpoints.forEach(function(caller) {
        var callee = endpoint;
        console.log('Existing Endpoint "' + caller.address + '" calling new Endpoint "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      // The new Endpoint INVITEs new, unINVITEed Endpoints.
      newEndpoints.shift().forEach(function(callee) {
        var caller = endpoint;
        console.log('New Endpoint "' + caller.address + '" calling new Endpoint "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      // The new Endpoint INVITEs existing Participants.
      participants.forEach(function(callee) {
        var caller = endpoint;
        console.log('New Endpoint "' + caller.address + '" calling existing Participant "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      return endpointInvitations.concat(invitations);
    }, []);

  var participantInvitations = invitees.participants
    .reduce(function(participantInvitations, participant) {
      var invitations = [];
      // Each existing and new Endpoint INVITEs the new Participant.
      allEndpoints.forEach(function(caller) {
        var callee = participant;
        console.log('Endpoint "' + caller.address + '" calling new Participant "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      return participantInvitations.concat(invitations);
    }, []);

  return Q.all(endpointInvitations.concat(participantInvitations));
};

Session.prototype._joined = function _joined(participant) {
  var joined = false;
  if (participant instanceof Endpoint) {
    if (!this._endpoints.has(participant)) {
      console.log('New Endpoint "' + participant.address + '" has joined');
      joined = true;
      this._endpoints.add(participant);
    }
  } else if (participant instanceof Participant) {
    if (!this._participants.has(participant)) {
      console.log('New Participant "' + participant.address + '" has joined');
      joined = true;
      this._participants.add(participant);
    }
  }
  if (joined) {
    this._log.info('Participant joined', participant);
    this.emit(PARTICIPANT_JOINED, participant);
  }
  return joined;
};

Session.prototype._left = function _left(participant) {
  var left = false;
  if (participant instanceof Endpoint) {
    if (this._endpoints.has(participant)) {
      console.log('New Endpoint "' + participant.address + '" has left');
      left = true;
      this._endpoints.delete(participant);
    }
  } else if (participant instanceof Participant) {
    if (this._participants.has(participant)) {
      console.log('New Participant "' + participant.address + '" has left');
      left = true;
      this._participants.delete(participant);
    }
  }
  if (left) {
    this._log.info('Participant left', participant);
    this.emit(PARTICIPANT_LEFT, participant);
  }
  return left;
};

/**
 * Removes one-or-more {@link Participant}s from the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - the
 *   {@link Participant} or the address of the {@link Participant} to remove
 * @returns {Promise<Session>}
 */
Session.prototype.remove = function remove(address) {
  var addresses = new Set(
    typeof address === 'string' || address instanceof Participant
      ? [address] : address);
  var endpoints = this._endpoints;
  var endpointAddresses = endpoints.map(function(endpoint) {
    return endpoint.address;
  });
  var _participants = this._participants;
  var _participantAddresses = _participants.map(function(participant) {
    return participant.address;
  });
  var participants = this.participants;
  var self = this;
  addresses.forEach(function(address) {
    var endpoint = null;
    var participant = null;
    if (address instanceof Endpoint) {
      endpoint = address;
      if (endpoints.has(endpoint)) {
        Q.all(participants.map(function(participant) {
          if (participant === endpoint) {
            return new Q();
          }
          // TODO(mroberts): We actually want to pass a SIP session or something.
          return endpoint._userAgent.hangup(self, participant);
        })).then(function() {
          self._endpoints.delete(endpoint);
          self.emit(PARTICIPANT_LEFT, endpoint);
        });
      }
    } else if (address instanceof Participant) {
      participant = address;
      if (_participants.has(participant)) {
        Q.all(endpoints.map(function(endpoint) {
          if (participant === endpoint) {
            return new Q();
          }
          // TODO(mroberts): We actually want to pass a SIP session or something.
          return endpoint._userAgent.hangup(self, participant);
        })).then(function() {
          self._participants.delete(participant);
          self.emit(PARTICIPANT_LEFT, participant);
        });
      }
    }
    if (endpointAddresses.has(address)) {
      endpoints.forEach(function(endpoint) {
        if (endpoint.address === address) {
          Q.all(endpoints.map(function(_endpoint) {
            // TODO(mroberts): We actually want to pass a SIP session or something.
            return _endpoint._userAgent.hangup(self, endpoint);
          })).then(function() {
            self._endpoints.delete(endpoint);
            self.emit(PARTICIPANT_LEFT, endpoint);
          });
        }
      });
    }
    if (_participantAddresses.has(address)) {
      _participants.forEach(function(participant) {
        if (participant.address === address) {
          Q.all(endpoints.map(function(endpoint) {
            // TODO(mroberts): We actually want to pass a SIP session or something.
            return endpoint._userAgent.hangup(self, participant);
          })).then(function() {
            self._participants.delete(participant);
            self.emit(PARTICIPANT_LEFT, participant);
          });
        }
      });
    }
  });
  return new Q(this);
};

function splitAddressesIntoEndpointsAndParticipants(addresses) {
  addresses =
    typeof addresses === 'string' || addresses instanceof Participant
      ? [addresses] : addresses;
  var endpoints = [];
  var _endpoints = new Set();
  var participants = [];
  var _participants = new Set();
  addresses.forEach(function(address) {
    if (address instanceof Endpoint) {
      if (!_endpoints.has(address)) {
        endpoints.push(address);
        _endpoints.add(address);
      }
    } else if (address instanceof Participant) {
      if (!_participants.has(address)) {
        participants.push(address);
        _participants.add(address);
      }
    } else if (typeof address === 'string') {
      var participant = Participant._getOrCreate(address);
      if (participant instanceof Endpoint) {
        if (!_endpoints.has(participant)) {
          endpoints.push(participant);
          _endpoints.add(participant);
        }
      } else {
        if (!_participants.has(participant)) {
          participants.push(participant);
          _participants.add(participant);
        }
      }
    }
  });
  return {
    endpoints: endpoints,
    participants: participants
  };
}

module.exports = Session;
