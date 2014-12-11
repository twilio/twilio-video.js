'use strict';

var Endpoint = require('./endpoint');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
var Set = require('./util/set');
var util = require('./util');
var Q = require('q');

/**
 * Constructs a {@link Session}.
 * @class
 * @classdesc A {@link Session} represents a call from your {@link Endpoint}
 * to one or more other {@link Endpoint}s.
 * @param {?Endpoint} creator - the {@link Endpoint} responsible for creating
 *   this {@link Session}
 * @param {?Set<Participant>} participants - the set of {@link Participant}s
 *   invited to this {@link Session}
 * @param {?object} render - render options for audio and video
 * @property {Set<Participant>} participants - the set of {@link Participant}s
 *   active in this {@link Session}
 * @fires Session#participantJoined
 * @fires Session#participantLeft
 */
function Session(creator, _participants, render) {
  if (!(this instanceof Session)) {
    return new Session(creator, _participants, render);
  }

  EventEmitter.call(this);

  creator = creator || null;
  _participants = _participants || [];
  var endpoints = new Set();
  if (creator) {
    endpoints.add(creator);
  }
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

  if (creator) {
    this.invite(creator);
  }
  this.invite(_participants);

  return Object.freeze(this);
}

inherits(Session, EventEmitter);

/**
 * Invites one-or-more {@link Participant}s to join the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - the
 *   {@link Participant} address to invite, for example
 *   <code>alice@owl-123.twil.io</code>
 * @returns {Session}
 */
Session.prototype.invite = function invite(address) {
  var addresses =
    typeof address === 'string' || address instanceof Participant
      ? [address] : address;
  var endpoints = this._endpoints;
  var _participants = this._participants;
  var participants = this.participants;
  var self = this;
  addresses.forEach(function(address) {
    var endpoint = null;
    var participant = null;
    if (address instanceof Endpoint) {
      endpoint = address;
      if (endpoints.has(endpoint)) {
        // Do nothing
      } else if (participants.size) {
        util.any(participants.map(function(participant) {
          return endpoint._userAgent.invite(participant.address);
        })).then(function() {
          endpoints.add(endpoint);
          self.emit('participantJoined', endpoint);
        });
      } else {
        setTimeout(function() {
          endpoints.add(endpoint);
          self.emit('participantJoined', endpoint);
        });
      }
    } else if (address instanceof Participant) {
      participant = address;
      if (participants.has(participant)) {
        // Do nothing
      } else if (endpoints.size) {
        util.any(endpoints.map(function(endpoint) {
          return endpoint._userAgent.invite(participant.address);
        })).then(function() {
          _participants.add(participant);
          self.emit('participantJoined', participant);
        });
      } else {
        setTimeout(function() {
          _participants.add(participant);
          self.emit('participantJoined', participant);
        });
      }
    } else if (endpoints.size) {
      participant = new Participant(address);
      util.any(endpoints.map(function(endpoint) {
        return endpoint._userAgent.invite(participant.address);
      })).then(function() {
        _participants.add(participant);
        self.emit('participantJoined', participant);
      });
    } else {
      participant = new Participant(address);
      setTimeout(function() {
        _participants.add(participant);
        self.emit('participantJoined', participant);
      });
    }
  });
  return this;
};

/**
 * Removes one-or-more {@link Participant}s from the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - the
 *   {@link Participant} or the address of the {@link Participant} to remove
 * @returns {Session}
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
            return Q();
          }
          // TODO(mroberts): We actually want to pass a SIP session or something.
          return endpoint._userAgent.hangup(participant.address);
        })).then(function() {
          self._endpoints.delete(endpoint);
          self.emit('participantLeft', endpoint);
        });
      }
    } else if (address instanceof Participant) {
      participant = address;
      if (_participants.has(participant)) {
        Q.all(endpoints.map(function(endpoint) {
          if (participant === endpoint) {
            return Q();
          }
          // TODO(mroberts): We actually want to pass a SIP session or something.
          return endpoint._userAgent.hangup(participant.address);
        })).then(function() {
          self._participants.delete(participant);
          self.emit('participantLeft', participant);
        });
      }
    }
    if (endpointAddresses.has(address)) {
      endpoints.forEach(function(endpoint) {
        if (endpoint.address === address) {
          Q.all(endpoints.map(function(_endpoint) {
            // TODO(mroberts): We actually want to pass a SIP session or something.
            return _endpoint._userAgent.hangup(endpoint.address);
          })).then(function() {
            self._endpoints.delete(endpoint);
            self.emit('participantLeft', endpoint);
          });
        }
      });
    }
    if (_participantAddresses.has(address)) {
      _participants.forEach(function(participant) {
        if (participant.address === address) {
          Q.all(endpoints.map(function(endpoint) {
            // TODO(mroberts): We actually want to pass a SIP session or something.
            return endpoint._userAgent.hangup(participant.address);
          })).then(function() {
            self._participants.delete(participant);
            self.emit('participantLeft', participant);
          });
        }
      });
    }
  });
  return this;
}

module.exports = Session;
