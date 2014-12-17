'use strict';

var inherits = require('util').inherits;

var SIPJSUserAgent = require('./sip/sipjsuseragent');
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
 * @param {?object} options
 * @property {string} address - the {@link Endpoint}'s address
 * @property {Set<Session>} sessions - the {@link Session}s this
 *   {@link Endpoint} is active in
 * @property {Map<Session, object>} streams - a Map from {@link Session}s to
 *   audio, video, or data streams offered by this {@link Endpoint}
 * @property {Set} allStreams - the set of all streams offered by this
 *   {@link Endpoint} across all {@link Session}s
 * @fires Endpoint#invite
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

  var accountSid = token._capabilityToken.accountSid;

  options = util.withDefaults(options, {
    'debug': false,
    'register': true,
    'userAgent': SIPJSUserAgent
  });

  Object.defineProperty(this, '_token', {
    value: token
  });

  var userAgent = new options['userAgent'](this, options);

  Object.defineProperties(this, {
    _userAgent: {
      value: userAgent
    },
    offline: {
      get: function() {
        return !userAgent.registered;
      }
    },
    online: {
      get: function() {
        return userAgent.registered;
      }
    }
  });

  var self = this;

  userAgent.on('unregistered', function() {
    self.emit('offline');
  });

  userAgent.on('registered', function() {
    self.emit('online');
  });

  userAgent.on('registrationFailed', function(error) {
    self.emit('error', error);
  });

  userAgent.on('invite', function(participant, session) {
    self.emit('invite', participant, session);
  });

  userAgent.on('hangup', function(participant, session) {
    self.emit('hangup', participant, session);
  });

  if (options['register']) {
    this.register();
  }

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
  var self = this;
  return this._userAgent.unregister().then(function() {
    // self._registered = false;
    return self;
  });
};

/**
 * Registers this {@link Endpoint} with Signal using the Signal ID provided
 * when you constructed the {@link Endpoint}, which will enable other Signal
 * {@link Eddpoint}s and Twilio applications to contact it.
 * @instance
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.register = function register() {
  var self = this;
  return this._userAgent.register().then(function() {
    // self._registered = true;
    return self;
  });
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
  var pending = [];
  this._userAgent._pending.forEach(function(dialog) {
    if (dialog.session === session) {
      pending.push(dialog);
    }
  });
  pending.forEach(function(dialog) {
    this._userAgent.accept(dialog);
  }, this);
  // FIXME(mroberts): ...
  if (pending.length === 0) {
    session.invite(this);
  }
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
