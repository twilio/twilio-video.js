'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Log = require('./util/log');
var Participant = require('./participant');
var Q = require('q');
var Session = require('./session');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var Sound = require('./media/sound');
var Token = require('./token');
var util = require('./util');

/**
 * Construct a new {@link Endpoint} from a {@link Token} or {@link Token}
 * string.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and can create or
 *   join {@link Session}s with other {@link Participant}s.
 * @extends Participant
 * @param {Token|string} token - the {@link Endpoint}'s {@link Token}
 * @property {string} address - the {@link Endpoint}'s address (defined by its
 *   {@link Token})
 * @property {Set<Session>} sessions - the {@link Session}s this
 *   {@link Endpoint} is active in
 * @property {Map<Session, Array<Stream>>} streams - a Map from
 *   {@link Session}s to the audio, video, or data {@link Stream}s offered by
 *   this {@link Endpoint} in that particular {@link Session}
 * @fires Endpoint#invite
 * @fires Endpoint#online
 * @fires Endpoint#offline
 * @fires Endpoint#error
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(token, options);
  }

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'logLevel': Log.INFO,
    'register': true,
    'sound': Sound.getDefault(),
    'userAgent': SIPJSUserAgent
  });

  token = token instanceof Token ? token : new Token(token);
  var address = token.address;
  var accountSid = token.accountSid;

  Log.mixin.call(this, '[Endpoint ' + address + ']', options);
  Participant.call(this, address);

  Object.defineProperties(this, {
    '_options': {
      value: options
    },
    '_sound': {
      value: options['sound']
    },
    '_token': {
      get: function() {
        return token;
      },
      set: function(_token) {
        token = _token;
      }
    },
    'offline': {
      enumerable: true,
      get: function() {
        return !this._userAgent.registered;
      }
    },
    'online': {
      enumerable: true,
      get: function() {
        return this._userAgent.registered;
      }
    },
    'token': {
      enumerable: true,
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

  this._log.debug('Created');

  return Object.freeze(this);
}

inherits(Endpoint, Participant);

Endpoint.prototype.toString = function toString() {
  return '[Endpoint ' + this.address + ']';
};

/**
 * Unregisters this {@link Endpoint}. This {@link Endpoint} will not receive
 * receive {@link Session} invites until it calls {@link Endpoint#register}
 * again.
 * @instance
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.unregister = function unregister() {
  this._log.info('Unregistering');
  var self = this;
  return this._userAgent.unregister().then(function() {
    self._log.info('Offline');
    return self;
  }, function(error) {
    self._log.warn('Unregistration failed', error);
  });
};

/**
 * Registers this {@link Endpoint} with address specified in the {@link Token}
 * when you constructed the {@link Endpoint}. This enables other
 * {@link Partcipant}s to invite this {@link Endpoint} to {@link Session}s.
 * @instance
 * @param {Token|string} [token] - a new {@link Token} or {@link Token} string
 *   to register with
 * @returns {Promise<Endpoint>}
 */
// TODO(mroberts): We should be able to re-register with a new token.
Endpoint.prototype.register = function register() {
  this._log.info('Registering');
  var self = this;
  return this._userAgent.register().then(function() {
    self._log.info('Online');
    return self;
  }, function(error) {
    self._log.warn('Registration failed', error);
  });
};

/**
 * Create a {@link Session} and invite the specified {@link Participant}s to
 * join.
 * <br><br>
 * By default, this will attempt to setup audio and video {@link Stream}s
 * between {@link Participant}s. You can override this by specifying
 * <code>constraints</code>.
 * @param {Participant|string|Array<Participant|string>} [participants] -
 *   one or more {@link Participant}s or {@link Participant} addresses to
 *   invite to the {@link Session}
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}]
 * @returns {Promise<Session>}
 */
// TODO(mroberts): I'm pretty sure constraints do not work right now.
Endpoint.prototype.createSession = function createSession(participants, options) {
  options = util.withDefaults(options, this._options);
  options['invite'] = false;
  this._sound.outgoing.play();
  var self = this;
  return Session.createSession(this, participants, options).then(function(session) {
    session._endpoints.add(self);
    self.sessions.add(session);
    session.invite(participants, options).then(function() {
      self._sound.outgoing.stop();
    }, function() {
      self._sound.outgoing.stop();
    });
    return session;
  }, function(error) {
    self._sound.outgoing.stop();
    return error;
  });
};

/**
 * Join a {@link Session}.
 * <br><br>
 * By default, this will attempt to setup audio and video {@link Stream}s
 * between {@link Participant}s. You can override this by specifying
 * @instance
 * @param {Session} session - the {@link Session} to join
 * @returns {Promise<Session>}
 */
// TODO(mroberts): I'm pretty sure constraints do not work right now.
Endpoint.prototype.join = function join(session, options) {
  var self = this;
  // TODO(mroberts): This should be a function on UserAgent.
  var pending = [];
  this._userAgent._pending.forEach(function(dialog) {
    if (dialog.session === session) {
      pending.push(dialog);
    }
  });
  if (pending.length === 0) {
    self._sound.outgoing.play();
    return session.invite(this, options).then(function() {
      self._sound.outgoing.stop();
      return session;
    }, function(error) {
      self._sound.outgoing.stop();
      return error;
    });
  }
  // TODO(mroberts): Here's another thing: we need to search the current
  // session participants, find those that we do not have pending dialogs for,
  // and create new ones. Hmm...
  return Q.all(pending.map(function(dialog) {
    return self._userAgent.accept(dialog, options);
  })).then(util.return(session));
};

/**
 * Leave one or more {@link Session}s. If no {@link Session} is provided this
 * leaves <em>all</em> {@link Session}s the {@link Endpoint} is active in.
 * @instance
 * @param {Session|Array<Session>} [session] - one or more {@link Session}s to leave
 * @returns {Promise<Session|Array<Session>>}
 */
Endpoint.prototype.leave = function leave(session) {
  var sessions = !session ? this.sessions : session;
  var self = this;
  if (typeof sessions.map === 'function') {
    return Q.all(sessions.map(function(session) {
      self._log.info('Leaving', session);
      return session.remove(self);
    }));
  }
  this._log.info('Leaving', session);
  return session.remove(this);
};

/**
 * Mute or unmute any audio this {@link Endpoint} is streaming in one or more
 * {@link Session}s. If no {@link Session} is provided, then this method mutes
 * or unmutes audio for <em>all</em> of this {@link Endpoint}'s
 * {@link Session}s.
 * @instance
 * @param {boolean} [mute=true] - whether to mute or unmute audio (defaults to mute)
 * @param {Session|Array<Session>} [session] - one or more {@link Session}s to
 *   mute or unmute audio for
 * @returns {Endpoint}
 */
Endpoint.prototype.muteAudio = function muteAudio(mute, session) {
  var streams = [];
  if (!session) {
    this.streams.forEach(function(_streams) {
      streams = streams.concat(_streams);
    });
  } else if (session instanceof Session) {
    streams = this.streams.get(session);
  } else if (typeof session.reduceRight === 'function') {
    streams = session.reduceRight(function(streams, session) {
      return streams.concat(this.streams.get(session));
    }, []);
  }
  streams.forEach(function(stream) {
    stream.muted = mute;
  });
  return this;
};

/**
 * Pause or unpause any video this {@link Endpoint} is streaming in one or more
 * {@link Session}s. If no {@link Session} is provided, then this method pauses
 * or unpauses video for <em>all</em> of this {@link Endpoint}'s
 * {@link Session}s.
 * @instance
 * @param {boolean} [pause=true] - whether to pause or unpause audio (defaults to pause)
 * @param {Session|Array<Session>} [session] - one or more {@link Session}s to
 *   pause or unpause video for
 * @returns {Endpoint}
 */
Endpoint.prototype.pauseVideo = function pauseVideo(pause, session) {
  var streams = [];
  if (!session) {
    this.streams.forEach(function(_streams) {
      streams = streams.concat(_streams);
    });
  } else if (session instanceof Session) {
    streams = this.streams.get(session);
  } else if (typeof session.reduceRight === 'function') {
    streams = session.reduceRight(function(streams, session) {
      return streams.concat(this.streams.get(session));
    }, []);
  }
  streams.forEach(function(stream) {
    stream.paused = pause;
  });
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
 * @param {Error} error - the Error object
 * @event Endpoint#error
 */

function setupUserAgentListeners(endpoint, userAgent) {
  userAgent.on('unregistered', function() {
    endpoint.emit('offline');
  });

  userAgent.on('registered', function() {
    endpoint.emit('online');
  });

  /* userAgent.on('registrationFailed', function(error) {
    endpoint.emit('error', error);
  }); */

  userAgent.on('invite', function(participant, session) {
    endpoint.emit('invite', session, participant);
  });

  return endpoint;
}

module.exports = Endpoint;
