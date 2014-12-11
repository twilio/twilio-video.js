'use strict';

var inherits = require('util').inherits;

var Token = require('./token');
var util = require('./util');
var Participant = require('./participant');

/**
 * Construct a new {@link Endpoint}.
 * @class
 * @classdesc A {@link Endpoint} can make or receive calls to Twilio or other
 *   {@link Endpoint}s.
 * @extends Participant
 * @param {string|Token} token - the {@link Endpoint}'s token
 * @param {?object} options - options
 * @property {Set<Session>} sessions - the {@link Session}s this
 *   {@link Endpoint} is active in
 * @fires Endpoint#incoming_session
 * @fires Endpoint#online
 * @fires Endpoint#offline
 * @fires Endpoint#error
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(options);
  }

  // TODO(mroberts): We're still using the capability token for address.
  if (typeof token === 'string') {
    token = new Token(token);
  }
  var address = token._capabilityToken.incomingClientName;
  Participant.call(this, address);

  Object.defineProperty(this, 'uuid', {
    value: util.makeUUID()
  });

  options = options || {};

  Object.defineProperties(this, {
    // Private
    _token: {
      value: token
    }
  });

  var self = this;

  this.register();

  return Object.freeze(this);
}

inherits(Endpoint, Participant);

/**
 * Unregisters this {@link Endpoint} with Signal. This {@link Endpoint} will
 * not receive incoming call or message notifications until it calls {@link
 * Endpoint#register}.
 * @instance
 * @returns {Endpoint}
 */
Endpoint.prototype.unregister = function unregister() {
  // TODO(mroberts): Perform actual SIP unregister.
  return this;
};

/**
 * Registers this {@link Endpoint} with Signal using the Signal ID provided
 * when you constructed the {@link Endpoint}, which will enable other Signal
 * {@link Eddpoint}s and Twilio applications to contact it.
 * @instance
 * @returns {Endpoint}
 */
Endpoint.prototype.register = function register() {
  if (this._capabilityToken && this._capabilityToken.supportsIncoming) {
    // TODO(mroberts): Perform actual SIP register.
  } else {
    var self = this;
    setTimeout(function() {
      self.emit('online');
    });
  }
  return this;
};

/**
 * Creates a {@link Session} and invites the specified addresses to join. By
 * default, this will attempt to setup an audio, video, and data session with
 * the {@link Endpoint}s at the addresses specified. You can override the
 * constraints of the communications {@link Session} using the
 * <code>options</code> argument.
 * @param {string|Participant|Array<string|Participant>} participants -
 *   One-or-more {@link Participant} addresses to invite to the {@link Session}.
 * @returns {Session}
 */
Endpoint.prototype.createSession = function createSession(participants, options) {
  var Session = require('./session');
  return new Session(this, participants);
};

/**
 * Join a {@link Session}.
 * @instance
 * @param {Session} session - the {@link Session} to join
 * @returns {Endpoint}
 */
Endpoint.prototype.join = function join(session) {
  session.invite(this);
  return this;
};

/**
 * Leave a {@link Session}.
 * @instance
 * @param {Session} session - the {@link Session} to leave
 * @returns {Endpoint}
 */
Endpoint.prototype.leave = function leave(session) {
  session.remove(this);
  return this;
};

module.exports = Endpoint;
