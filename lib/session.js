'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Map = require('es6-map');
var Set = require('./util/set');
var util = require('./util');
var Q = require('q');

var PARTICIPANT_JOINED = 'participantJoined';
var PARTICIPANT_LEFT = 'participantLeft';

// Session maintains a map from Session SIDs to Sessions.
var registry = util.sessionRegistry;

/**
 * Construct a {@link Session}.
 * @class
 * @classdesc A {@link Session} represents a communication from one or more
 *   {@link Endpoint}s to one or more local or remote {@link Participant}s.
 *   <br><br>
 *   You should not call {@link Session}'s constructor directly; instead, call
 *   {@link Endpoint#createSession}.
 * @param {Endpoint} [creator] - the {@link Endpoint} responsible for creating
 *   this {@link Session}
 * @param {Set<Participant>} [participants] - the initial set of {@link Participant}s
 *   to invite to this {@link Session}
 * @property {Set<Participant>} participants - the set of {@link Participant}s
 *   active in this {@link Session}
 * @fires Session#participantJoined
 * @fires Session#participantLeft
 */
function Session(creator, _participants, options) {
  if (!(this instanceof Session)) {
    return new Session(creator, _participants, options);
  }

  options = util.withDefaults(options, {
    'logLevel': Log.INFO,
    'invite': true
  });

  EventEmitter.call(this);

  creator = creator || null;
  _participants = _participants || [];
  _participants =
    typeof _participants === 'string' || _participants instanceof require('./participant')
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

  Log.mixin.call(this, '[Session ' + this._uuid + ']', options);

  var sessionSid = this._uuid;
  registry.set(sessionSid, this);

  if (options['invite']) {
    this.invite(_participants);
  }

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
    sessionSid = session._uuid;
    registry.set(sessionSid, session);
  }
  return session;
};

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

Session.createSession = function createSession(endpoint, participants, options) {
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(new Session(endpoint, participants, options));
  });
  return deferred.promise;
};

// NOTE(mroberts): A lot to clean up down here.

Session.prototype.toString = function toString() {
  return '[Session ' + this._uuid + ']';
};

/**
 * Get the remote {@link Stream}s associated with this {@link Session}
 * @instance
 * @returns {Array<Stream>}
 */
Session.prototype.getRemoteStreams = function getRemoteStreams() {
  var self = this;
  var remoteStreams = [];
  this._participants.forEach(function(participant) {
    remoteStreams = remoteStreams.concat(participant.streams.get(self));
  });
  return remoteStreams;
};

/**
 * Get the local {@link Stream}s associated with this {@link Session}
 * @instance
 * @returns {Array<Stream>}
 */
Session.prototype.getLocalStreams = function getLocalStreams() {
  var self = this;
  var localStreams = [];
  this._endpoints.forEach(function(endpoint) {
    localStreams = localStreams.concat(endpoint.streams.get(self));
  });
  return localStreams;
};

/**
 * Invite one or more {@link Participant}s to join the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - one or
 *   more {@link Participant}s or {@link Participant} addresses to invite
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
        self._log.info('Existing Endpoint "' + caller.address + '" calling new Endpoint "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      // The new Endpoint INVITEs new, unINVITEed Endpoints.
      newEndpoints.shift().forEach(function(callee) {
        var caller = endpoint;
        self._log.info('New Endpoint "' + caller.address + '" calling new Endpoint "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      // The new Endpoint INVITEs existing Participants.
      participants.forEach(function(callee) {
        var caller = endpoint;
        self._log.info('New Endpoint "' + caller.address + '" calling existing Participant "' + callee.address + '"');
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
        self._log.info('Endpoint "' + caller.address + '" calling new Participant "' + callee.address + '"');
        var invitation = caller._userAgent.invite(self, callee);
        invitations.push(invitation);
      });
      return participantInvitations.concat(invitations);
    }, []);

  return util.any(endpointInvitations.concat(participantInvitations))
             .then(util.return(this));
};

Session.prototype._joined = function _joined(participant) {
  var Endpoint = require('./endpoint'); var Participant = require('./participant');
  var joined = false;
  if (participant instanceof Endpoint) {
    if (!this._endpoints.has(participant)) {
      this._log.info('New Endpoint "' + participant.address + '" has joined');
      joined = true;
      this._endpoints.add(participant);
    }
  } else if (participant instanceof Participant) {
    if (!this._participants.has(participant)) {
      this._log.info('New Participant "' + participant.address + '" has joined');
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
  var Endpoint = require('./endpoint'); var Participant = require('./participant');
  var left = false;
  if (participant instanceof Endpoint) {
    if (this._endpoints.has(participant)) {
      this._log.info('New Endpoint "' + participant.address + '" has left');
      left = true;
      this._endpoints.delete(participant);
    }
  } else if (participant instanceof Participant) {
    if (this._participants.has(participant)) {
      this._log.info('New Participant "' + participant.address + '" has left');
      left = true;
      this._participants.delete(participant);
    }
  }
  if (left) {
    var streams = participant.streams.get(this);
    participant.streams.delete(this);
    streams.forEach(function(stream) {
      stream.stop();
    });
    this._log.info('Participant left', participant);
    this.emit(PARTICIPANT_LEFT, participant);
    if (this._endpoints.size === 1) {
      this.getLocalStreams().forEach(function(stream) {
        // TODO(mroberts): This isn't the final solution.
        stream.stop();
      });
    }
  }
  return left;
};

/**
 * Remove one or more {@link Participant}s from the {@link Session}.
 * @instance
 * @param {Participant|string|Array<Participant|string>} participant - one or
 *   more {@link Participant}s or {@link Participant} addresses to remove
 * @returns {Promise<Session>}
 */
Session.prototype.remove = function remove(address) {
  var removals = splitAddressesIntoEndpointsAndParticipants(address);

  var self = this;

  var endpoints = this._endpoints;
  var participants = this._participants;

  var endpointToParticipantByes = removals.participants
    .reduce(function(byes, participant) {
      // Each existing Endpoint sends a BYE to the removed Participants.
      return byes.concat(endpoints.map(function(endpoint) {
        return endpoint._userAgent.hangup(self, participant);
      }));
    }, []);

  var endpointRemovals = util.tails(removals.endpoints).slice(1);

  var endpointToEndpointByes = removals.endpoints
    .reduce(function(byes, endpoint) {
      // Each Endpoint to be removed sends a BYE to the Endpoints to be kept.
      endpoints.forEach(function(_endpoint) {
        byes.push(endpoint._userAgent.hangup(self, _endpoint));
      });
      // Each Endpoint to be removed sends a BYE to the Participants.
      participants.forEach(function(participant) {
        byes.push(endpoint._userAgent.hangup(self, participant));
      });
      // Each Endpoint to be removed sends a BYE to the Endpoints to be removed
      // that have not yet received a BYE.
      byes = byes.concat(endpointRemovals.shift().map(function(_endpoint) {
        return endpoint._userAgent.hangup(self, _endpoint);
      }));
      return byes;
    }, []);

  endpoints.forEach(function(endpoint) {
    // FIXME: ...
    endpoint._userAgent._pending.forEach(function(dialog) {
      dialog._sipjsSession.cancel();
      endpoint._userAgent._pending.delete(dialog);
    });
  });

  return util.any(endpointToParticipantByes.concat(endpointToEndpointByes))
             .then(util.return(this));
};

function splitAddressesIntoEndpointsAndParticipants(addresses) {
  var Endpoint = require('./endpoint'); var Participant = require('./participant');
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

module.exports = Session;
