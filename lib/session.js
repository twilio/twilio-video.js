'use strict';

var Endpoint = require('./endpoint');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
var Set = require('./util/set');

/**
 * Constructs a {@link Session}.
 * @class
 * @classdesc A {@link Session} represents a call from your {@link Endpoint}
 * to one or more other {@link Endpoint}s.
 * @param {?Endpoint} creator - the {@link Endpoint} responsible for creating
 *   this {@link Session}
 * @param {Set<Participant>} participants - the set of {@link Participant}s
 *   invited to this {@link Session}
 * @param {object} render - render options for audio and video
 * @property {Set<Participant>} participants - the set of {@link Participant}s
 *   active in this {@link Session}
 */
function Session(creator, _participants, render) {
  if (!(this instanceof Session)) {
    return new Session(creator, _participants, render);
  }

  EventEmitter.call(this);

  creator = creator || null;
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

  this.invite(_participants);

  return this;
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
  addresses.forEach(function(address) {
    if (address instanceof Endpoint) {
      if (this._endpoints.has(address)) {
        // Do nothing
      } else {
        this._endpoints.add(address);
      }
    } else if (address instanceof Participant) {
      if (this._participants.has(address)) {
        // Do nothing
      } else {
        this._participants.add(address);
      }
    } else {
      var participant = new Participant(address);
      // TODO(mroberts): Actually INVITE the Participant.
      this._participants.add(participant);
    }
  }, this);
  return this;
};

/**
 * Removes one-or-more {@link Participant}s from the {@link Session}.
 * @instance
 * @param {string|Participant|Array<string|Participant>} participant - the
 *   {@link Participant} to remove
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
  var participants = this._participants;
  var participantAddresses = participants.map(function(participant) {
    return participant.address;
  });
  addresses.forEach(function(address) {
    if (address instanceof Endpoint) {
      if (endpoints.has(address)) {
        // TODO(mroberts): Send a BYE from this Endpoint to all other Endpoints and Participants.
        this._endpoints.delete(address);
      }
    } else if (address instanceof Participant) {
      if (participants.has(address)) {
        // TODO(mroberts): Send a BYE from every Endpoint to this Participant.
        this._participants.delete(address);
      }
    }
    if (endpointAddresses.has(address)) {
      endpoints.forEach(function(endpoint) {
        if (endpoint.address === address) {
          // TODO(mroberts): Send a BYE from this Endpoint to all other Endpoints and Participants.
          this._endpoints.delete(endpoint);
        }
      }, this);
    }
    if (participantAddresses.has(address)) {
      participants.forEach(function(participant) {
        if (participant.address === address) {
          // TODO(mroberts): Send a BYE from every Endpoint to this Participant.
          this._participants.delete(participant);
        }
      }, this);
    }
  }, this);
  return this;
}

module.exports = Session;
