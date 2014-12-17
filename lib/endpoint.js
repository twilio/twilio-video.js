'use strict';

var inherits = require('util').inherits;

var SIPJSUserAgent = require('./sip/sipjsuseragent');
var Token = require('./token');
var util = require('./util');
var Participant = require('./participant');
var Q = require('q');

/**
 * Construct a new {@link Endpoint}.
 * @class
 * @classdesc An {@link Endpoint} can make or receive calls to Twilio or other
 *   {@link Endpoint}s.
 * @extends Participant
 * @param {string|Token} token - the {@link Endpoint}'s token
 * @param {?object} options
 * @property {string} address - the {@link Endpoint}'s address
 * @property {Set<Session>} sessions - the {@link Session}s this
 *   {@link Endpoint} is active in
 * @property {Map<Session, object>} streams - a Map from {@link Session}s to
 *   audio, video, or data streams offered by this {@link Endpoint}
 * @fires Endpoint#invite
 * @fires Endpoint#online
 * @fires Endpoint#offline
 * @fires Endpoint#error
 * @fires Endpoint#connectionDegraded
 * @fires Endpoint#connectionImproved
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(options);
  }

  options = util.withDefaults(options, {
    'debug': false,
    'register': true,
    'userAgent': SIPJSUserAgent
  });

  token = token instanceof Token ? token : new Token(token);
  var address = token.address;
  var accountSid = token.accountSid;

  Participant.call(this, address);

  Object.defineProperties(this, {
    '_token': {
      get: function() {
        return token;
      },
      set: function(_token) {
        token = _token;
      }
    },
    'offline': {
      get: function() {
        return !userAgent.registered;
      }
    },
    'online': {
      get: function() {
        return userAgent.registered;
      }
    },
    'token': {
      get: function() {
        return this._token;
      }
    }
  });

  var userAgent = new options['userAgent'](this, options);
  Object.defineProperty(this, '_userAgent', {
    value: userAgent
  });

  setupUserAgentListeners(this, userAgent);

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
 * @returns {Promise<Endpoint>}
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
 * @returns {Promise<Session>}
 */
Endpoint.prototype.createSession = function createSession(participants, options) {
  var Session = require('./session');
  var session = new Session(this, participants);
  return new Q(session);
};

/**
 * Join a {@link Session}.
 * @instance
 * @param {Session} session - the {@link Session} to join
 * @param {?object} options
 * @returns {Promise<Session>}
 */
Endpoint.prototype.join = function join(session, options) {
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
  return new Q(session);
};

/**
 * Leave a {@link Session}.
 * @instance
 * @param {Session} session - the {@link Session} to leave
 * @returns {Promise<Session>}
 */
Endpoint.prototype.leave = function leave(session) {
  session.remove(this);
  return new Q(session);
};

/**
 * Pause any video this {@link Endpoint} is streaming to a {@link Session}. If
 * no {@link Session} is provided this method pauses video for <em>all</em> of
 * this {@link Endpoint}'s {@link Session}s.
 * @instance
 * @param {?Session} session - the {@link Session} to pause video for
 * @returns {Endpoint}
 */
Endpoint.prototype.pauseVideo = function pauseVideo(session) {
  if (!session) {
    this.sessions.forEach(function(session) {
      this.pauseVideo(session);
    }, this);
  } else {
    // TODO(mroberts): ...
  }
  return this;
};

/**
 * Mute any audio this {@link Endpoint} is streaming to a {@link Session}. If
 * no {@link Session} is provided this method mutes audio for <em>all</em> of
 * this {@link Endpoint}'s {@link Session}s.
 * @instance
 * @param {?Session} session - the {@link Session} to mute audio for
 * @returns {Endpoint}
 */
Endpoint.prototype.muteAudio = function muteAudio(session) {
  if (!session) {
    this.sessions.forEach(function(session) {
      this.muteAudio(session);
    }, this);
  } else {
    // TODO(mroberts): ...
  }
  return this;
};

/**
 * Another {@link Participant} has invited the {@link Endpoint} to a
 * {@link Session}.
 * @event Endpoint#invite
 * @param {Session} session - the {@link Session} the {@link Endpoint} has been
 *   invited to
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.on('invite', function(session) {
 *   alice.join(session);
 * });
 */

/**
 * The {@link Endpoint} has successfully connected and registered to Twilio.
 * @event Endpoint#online
 */

/**
 * The {@link Endpoint} has lost its connection to Twilio or its registration
 * has expired.
 * @event Endpoint#offline
 */

/**
 * The {@link Endpoint} has encountered an error.
 * @event Endpoint#error
 */

/**
 * The {@link Endpoint}'s connection to a {@link Participant} within a
 * {@link Session} has degraded.
 * @event Endpoint#connectionDegraded
 * @param {Session} session
 * @param {Participant} participant
 */

/**
 * The {@link Endpoint}'s connection to a {@link Participant} within a
 * {@link Session} has improved.
 * @event Endpoint#connectionImproved
 * @param {Session} session
 * @param {Participant} participant
 */

function setupUserAgentListeners(endpoint, userAgent) {
  userAgent.on('unregistered', function() {
    endpoint.emit('offline');
  });

  userAgent.on('registered', function() {
    endpoint.emit('online');
  });

  userAgent.on('registrationFailed', function(error) {
    endpoint.emit('error', error);
  });

  userAgent.on('invite', function(participant, session) {
    endpoint.emit('invite', participant, session);
  });

  userAgent.on('hangup', function(participant, session) {
    endpoint.emit('hangup', participant, session);
  });

  return endpoint;
}

module.exports = Endpoint;
