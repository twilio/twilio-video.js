'use strict';

var inherits = require('util').inherits;

var CapabilityToken = require('./capabilitytoken');
var util = require('./util');
var Participant = require('./participant');

var SIPUA_FACTORY = require('./signaling').SipUAFactory;

/**
 * Construct a new {@link Endpoint}.
 * @class
 * @classdesc A {@link Endpoint} can make or receive calls to Twilio or other
 *   {@link Endpoint}s.
 * @extends Participant
 * @param {string} token - the {@link Endpoint}'s token
 * @param {?object} options - options
 * @fires Endpoint#incoming_session
 * @fires Endpoint#online
 * @fires Endpoint#offline
 * @fires Endpoint#error
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(options);
  }

  // TODO(mroberts): Pull the address out of the token.
  var address = 'foo@twil.io';
  Participant.call(this, address);

  Object.defineProperty(this, 'uuid', {
    value: util.makeUUID()
  });

  options = options || {};

  var sipUAFactory = 'sipUAFactory' in options
                   ? options['sipUAFactory']
                   : SIPUA_FACTORY.getInstance(options);
  var sipUA = sipUAFactory.addEndpoint(this);

  // TODO(mroberts): Split token into two.
  var capabilityToken = null;
  var stunTurnToken = null;

  Object.defineProperties(this, {
    // Private
    _capabilityToken: {
      get: function() {
        return capabilityToken;
      },
      set: function(_capabilityToken) {
        capabilityToken = _capabilityToken;
      }
    },
    _sipUA: {
      value: sipUA
    },
    _stunTurnToken: {
      get: function() {
        return stunTurnToken;
      },
      set: function(_stunTurnToken) {
        stunTurnToken = _stunTurnToken;
      }
    }
  });

  var self = this;

  sipUA.on('incoming', function(session) {
    console.log('Endpoint emitting "incoming"');
    self.emit('incoming_session', session);
  });

  sipUA.on('error', function(error) {
    self.emit('error', error);
  });

  sipUA.on('registered', function() {
    self.emit('online');
  });

  sipUA.on('unregistered', function() {
    self.emit('offline');
  });

  sipUA.on('registrationFailed', function() {
    self.emit('error', new Error('Registration failed'));
  });

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
  this._sipUA.unregister();
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
  if (this._capabilityToken.supportsIncoming) {
    this._sipUA.register(this._capabilityToken);
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
 * @param {string|Array<string>} addresses - One or more addresses to invite
 *   to the {@link Session}.
 * @returns {OutgoingSession}
 */
Endpoint.prototype.createSession = function connect(addresses, options) {
  if (typeof addresses === 'string') {
    addresses = [addresses];
  }
  // TODO(mroberts): Actually, we want the Session to encapsulate a number of
  // SIP sessions. Hmm...
  var self = this;
  var sessions = addresses.map(function(address) {
    // TODO(mroberts): Not actually using the address here...
    return self._sipUA.call(self.capabilityToken, options);
  });
  // TODO: ...
  // return new OutgoingSession(sessions);
};

/**
 * Join a {@link Session}.
 * @instance
 * @param {Session} session - the {@link Session} to join
 * @returns {Endpoint}
 */
Endpoint.prototype.join = function join(session) {
  session.addParticipant(this);
  return this;
};

module.exports = Endpoint;
