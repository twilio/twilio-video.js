'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Map = require('es6-map');
var Set = require('./util/set');
var Stream = require('./media/stream');
var util = require('./util');
var Q = require('q');

var PARTICIPANT_JOINED = 'participantJoined';
var PARTICIPANT_LEFT = 'participantLeft';

// Conversation maintains a map from Conversation SIDs to Conversations.
var registry = util.sessionRegistry;

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents a communication from one or more
 *   {@link Endpoint}s to one or more local or remote {@link Twilio.Signal.RemoteEndpoint}s.
 *   <br><br>
 *   You should not call {@link Conversation}'s constructor directly; instead, call
 *   {@link Endpoint#createConversation}.
 * @memberof Twilio.Signal
 * @param {Set<Twilio.Signal.RemoteEndpoint>} [participants] - the initial set of {@link Twilio.Signal.RemoteEndpoint}s
 *   to invite to this {@link Conversation}
 * @property {Set<Twilio.Signal.RemoteEndpoint>} participants - the set of {@link Twilio.Signal.RemoteEndpoint}s
 *   active in this {@link Conversation}
 * @fires Twilio.Signal.Conversation#participantJoined
 * @fires Twilio.Signal.Conversation#participantLeft
 */
function Conversation(dialogs, options) {
  dialogs = dialogs || [];
  if (!(this instanceof Conversation)) {
    return new Conversation(dialogs, options);
  }

  options = util.withDefaults(options, {
    'logLevel': Log.INFO,
    'invite': true
  });

  EventEmitter.call(this);

  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    'participants': {
      enumerable: true,
      get: function() {
        return new Set();
      }
    }
  });

  Log.mixin.call(this, '[Conversation ' + this._uuid + ']', options);

  var sessionSid = this._uuid;
  registry.set(sessionSid, this);

  this._log.debug('Created');

  return Object.freeze(this);
}

inherits(Conversation, EventEmitter);

// NOTE(mroberts): The following aren't going into JSDoc until I figure out
// how to mark public/private.

Conversation._registry = registry;

Conversation._reset = function _reset() {
  registry.clear();
  return Conversation;
};

/*
 * Get an existing {@link Conversation} by SID.
 * @param {string} sessionSid - the {@link Conversation} SID
 * @returns {?Conversation}
 */
Conversation._get = function _get(sessionSid) {
  return registry.get(sessionSid) || null;
};

/*
 * Get an existing {@link Conversation} by SID, or create it if not present.
 * @param {string} sessionSid - the {@link Conversation} SID
 * @returns {Conversation}
 */
Conversation._getOrCreate = function _getOrCreate(sessionSid) {
  var session = Conversation._get(sessionSid);
  if (!session) {
    session = new Conversation();
    // FIXME(mroberts): Need to be able to set SID on Conversation.
    sessionSid = session._uuid;
    registry.set(sessionSid, session);
  }
  return session;
};

/*
 * Delete a {@link Conversation}, preventing future lookup.
 * @param {Conversation}
 * @returns {?Conversation}
 */
Conversation._delete = function _delete(session) {
  var sessionSid = session._uuid;
  if (Conversation._get(sessionSid)) {
    registry.delete(sessionSid);
    return session;
  }
  return null;
};

Conversation.createConversation = function createConversation(endpoint, participants, options) {
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(new Conversation(endpoint, participants, options));
  });
  return deferred.promise;
};

// NOTE(mroberts): A lot to clean up down here.

Conversation.prototype.toString = function toString() {
  return '[Conversation ' + this._uuid + ']';
};

/**
 * Get the remote {@link Stream}s associated with this {@link Conversation}
 * @instance
 * @param {string|RemoteEndpoint} [filter] - a {@link RemoteEndpoint} or
 *   {@link RemoteEndpoint} address to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getRemoteStreams = function getRemoteStreams(filter) {
  var self = this;
  var remoteStreams = [];
  this._participants.forEach(function(participant) {
    if (!filter
      || (typeof filter === 'string' && participant.address === filter)
      || filter === participant)
    {
      remoteStreams = remoteStreams.concat(participant.streams.get(self));
    }
  });
  return remoteStreams;
};

/**
 * Get the local {@link Stream}s associated with this {@link Conversation}
 * @instance
 * @param {string|Endpoint} [filter] - an {@link Endpoint} or {@link Endpoint}
 *   address to filter by
 * @returns {Array<Stream>}
 */
Conversation.prototype.getLocalStreams = function getLocalStreams(filter) {
  var self = this;
  var localStreams = [];
  this._endpoints.forEach(function(endpoint) {
    if (!filter
      || (typeof filter === 'string' && endpoint.address === filter)
      || filter === endpoint)
    {
      localStreams = localStreams.concat(endpoint.streams.get(self));
    }
  });
  return localStreams;
};

Conversation.prototype._joined = function _joined(participant) {
  var Endpoint = require('./endpoint'); var RemoteEndpoint = require('./participant');
  var joined = false;
  if (participant instanceof Endpoint) {
    if (!this._endpoints.has(participant)) {
      this._log.info('New Endpoint "' + participant.address + '" has joined');
      joined = true;
      this._endpoints.add(participant);
    }
  } else if (participant instanceof RemoteEndpoint) {
    if (!this._participants.has(participant)) {
      this._log.info('New RemoteEndpoint "' + participant.address + '" has joined');
      joined = true;
      this._participants.add(participant);
    }
  }
  if (joined) {
    this._log.info('RemoteEndpoint joined', participant);
    this.emit(PARTICIPANT_JOINED, participant);
  }
  return joined;
};

Conversation.prototype._left = function _left(participant) {
  var Endpoint = require('./endpoint'); var RemoteEndpoint = require('./participant');
  var left = false;
  if (participant instanceof Endpoint) {
    if (this._endpoints.has(participant)) {
      this._log.info('New Endpoint "' + participant.address + '" has left');
      left = true;
      this._endpoints.delete(participant);
    }
  } else if (participant instanceof RemoteEndpoint) {
    if (this._participants.has(participant)) {
      this._log.info('New RemoteEndpoint "' + participant.address + '" has left');
      left = true;
      this._participants.delete(participant);
    }
  }
  if (left) {
    var streams = participant.streams.get(this);
    participant.streams.delete(this);
    if (streams) {
      streams.forEach(function(stream) {
        stream.stop();
      });
    }
    this._log.info('RemoteEndpoint left', participant);
    this.emit(PARTICIPANT_LEFT, participant);
    if (this._endpoints.size === 1) {
      this.getLocalStreams().forEach(function(stream) {
        // TODO(mroberts): This isn't the final solution.
        if (stream) {
          stream.stop();
        }
      });
    }
  }
  return left;
};

/**
 * Remove one or more {@link RemoteEndpoint}s from the {@link Conversation}.
 * @instance
 * @param {RemoteEndpoint|string|Array<RemoteEndpoint|string>} participant - one or
 *   more {@link RemoteEndpoint}s or {@link RemoteEndpoint} addresses to remove
 * @returns {Promise<Conversation>}
 */
Conversation.prototype.remove = function remove(address) {
  var removals = splitAddressesIntoEndpointsAndRemoteEndpoints(address);

  var self = this;

  var endpoints = this._endpoints;
  var participants = this._participants;

  var endpointToRemoteEndpointByes = removals.participants
    .reduce(function(byes, participant) {
      // Each existing Endpoint sends a BYE to the removed RemoteEndpoints.
      return byes.concat(endpoints.map(function(endpoint) {
        return endpoint._userAgent.hangup(self, participant)
          .then(function(dialog) {
            self._left(participant);
            return dialog;
          });
      }));
    }, []);

  var endpointRemovals = util.tails(removals.endpoints).slice(1);

  var endpointToEndpointByes = removals.endpoints
    .reduce(function(byes, endpoint) {
      // Each Endpoint to be removed sends a BYE to the Endpoints to be kept.
      endpoints.forEach(function(_endpoint) {
        byes.push(endpoint._userAgent.hangup(self, _endpoint)
          .then(function(dialog) {
            self._left(endpoint);
            return dialog;
          }));
      });
      // Each Endpoint to be removed sends a BYE to the RemoteEndpoints.
      participants.forEach(function(participant) {
        byes.push(endpoint._userAgent.hangup(self, participant)
          .then(function(dialog) {
            self._left(endpoint);
            return dialog;
          }));
      });
      // Each Endpoint to be removed sends a BYE to the Endpoints to be removed
      // that have not yet received a BYE.
      byes = byes.concat(endpointRemovals.shift().map(function(_endpoint) {
        return endpoint._userAgent.hangup(self, _endpoint)
          .then(function(dialog) {
            self._left(endpoint);
            return dialog;
          });
      }));
      return byes;
    }, []);

  endpoints.forEach(function(endpoint) {
    // FIXME: ...
    endpoint._userAgent._pending.forEach(function(dialog) {
      dialog._sipjsConversation.cancel();
      endpoint._userAgent._pending.delete(dialog);
    });
  });

  return util.any(endpointToRemoteEndpointByes.concat(endpointToEndpointByes))
             .then(util.return(this));
};

function splitAddressesIntoEndpointsAndRemoteEndpoints(addresses) {
  var Endpoint = require('./endpoint'); var RemoteEndpoint = require('./participant');
  addresses =
    typeof addresses === 'string' || addresses instanceof RemoteEndpoint
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
    } else if (address instanceof RemoteEndpoint) {
      if (!_participants.has(address)) {
        participants.push(address);
        _participants.add(address);
      }
    } else if (typeof address === 'string') {
      var participant = RemoteEndpoint._getOrCreate(address);
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
 * A {@link RemoteEndpoint} has joined the {@link Conversation}.
 * @event Twilio.Signal.Conversation#participantJoined
 * @param {RemoteEndpoint} participant
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.createConversation("bob@twil.io").then(function(session) {
 *   session.once('participantJoined', function(participant) {
 *     // Prints "bob@twil.io joined!"
 *     console.log(participant.address + ' joined!');
 *   });
 * });
 */

/**
 * A {@link RemoteEndpoint} has left the {@link Conversation}.
 * @event Twilio.Signal.Conversation#participantLeft
 * @param {RemoteEndpoint} participant
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.createConversation("bob@twil.io").then(function(session) {
 *   alice.leave(session);
 *   session.once('participantLeft', function(participant) {
 *     // Prints "alice@twil.io left!"
 *     console.log(participant.address + ' left!');
 *   });
 * });
 */

module.exports = Conversation;
