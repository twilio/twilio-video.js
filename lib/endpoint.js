'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Conversation = require('./conversation');
var Invite = require('./invite');
var Log = require('./util/log');
var Q = require('q');
var RemoteEndpoint = require('./remoteendpoint');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var Sound = require('./media/sound');
var Token = require('./token');
var util = require('./util');

/**
 * Construct a new {@link Endpoint} from a {@link Token} or {@link Token}
 * string.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and can create or
 *   join {@link Conversation}s with other {@link RemoteEndpoint}s.
 * @memberof Twilio.Signal
 * @augments Twilio.Signal.RemoteEndpoint
 * @param {Token|string} token - the {@link Endpoint}'s {@link Token}
 * @property {string} address - the {@link Endpoint}'s address (defined by its
 *   {@link Token})
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this
 *   {@link Endpoint} is active in
 * @property {Map<Conversation, Array<Stream>>} streams - a Map from
 *   {@link Conversation}s to the audio, video, or data {@link Stream}s offered by
 *   this {@link Endpoint} in that particular {@link Conversation}
 * @fires Twilio.Signal.Endpoint#invite
 * @fires Twilio.Signal.Endpoint#online
 * @fires Twilio.Signal.Endpoint#offline
 * @fires Twilio.Signal.Endpoint#error
 */ 
function Endpoint(token, options) {
  token = typeof token === 'string' ? new Token(token) : token;
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

  var address = token.incomingClientName;
  var accountSid = token.accountSid;

  Log.mixin.call(this, '[Endpoint ' + address + ']', options);
  RemoteEndpoint.call(this);

  Object.defineProperties(this, {
    '_options': {
      value: options
    },
    '_sound': {
      value: options['sound']
    },
    'address': {
      enumerable: true,
      get: function() {
        return this._userAgent.token.incomingClientName;
      }
    },
    'registered': {
      enumerable: true,
      get: function() {
        return this._userAgent.registered;
      }
    },
    'token': {
      enumerable: true,
      get: function() {
        return this._userAgent.token;
      }
    }
  });

  var userAgent = new options['userAgent'](token, options);
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

inherits(Endpoint, RemoteEndpoint);

Endpoint.prototype.toString = function toString() {
  return '[Endpoint ' + this.address + ']';
};

/**
 * Unregisters this {@link Endpoint}. This {@link Endpoint} will not receive
 * receive {@link Conversation} invites until it calls {@link Endpoint#register}
 * again.
 * @instance
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.unregister = function unregister() {
  var self = this;
  return this._userAgent.unregister().then(function() {
    setTimeout(function() {
      self.emit('unregistered', self);
    });
    return self;
  }, function(error) {
    setTimeout(function() {
      self.emit('unregistered', self);
    });
  });
};

/**
 * Registers this {@link Endpoint} with address specified in the {@link Token}
 * when you constructed the {@link Endpoint}. This enables other
 * {@link Partcipant}s to invite this {@link Endpoint} to {@link Conversation}s.
 * @instance
 * @param {Token|string} [token] - a new {@link Token} or {@link Token} string
 *   to register with
 * @returns {Promise<Endpoint>}
 */
// TODO(mroberts): We should be able to re-register with a new token.
Endpoint.prototype.register = function register(token) {
  var self = this;
  return this._userAgent.register(token).then(function() {
    setTimeout(function() {
      self.emit('registered', self);
    });
    return self;
  }, function(error) {
    setTimeout(function() {
      self.emit('registrationFailed', error);
    });
    throw error;
  });
};

/**
 * Create a {@link Conversation} and invite the specified {@link RemoteEndpoint}s to
 * join.
 * <br><br>
 * By default, this will attempt to setup audio and video {@link Stream}s
 * between {@link RemoteEndpoint}s. You can override this by specifying
 * <code>constraints</code>.
 * @param {RemoteEndpoint|string|Array<RemoteEndpoint|string>} [remoteendpoints] -
 *   one or more {@link RemoteEndpoint}s or {@link RemoteEndpoint} addresses to
 *   invite to the {@link Conversation}
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}]
 * @returns {Promise<Conversation>}
 */
// TODO(mroberts): I'm pretty sure constraints do not work right now.
Endpoint.prototype.createConversation = function createConversation(address, options) {
  var self = this;
  var addresses = address.forEach ? address : [address];
  options = util.withDefaults(options, this._options);
  this._sound.outgoing.play();
  var conversation = new Conversation();
  var inviteClientTransactions = addresses.map(function(address) {
    return self._userAgent.invite(address).then(function(dialog) {
      conversation._dialogs.push(dialog);
    });
  });
  return util.any(inviteClientTransactions).then(function() {
    self._sound.outgoing.stop();
    self.conversations.add(conversation);
    return conversation;
  }, function(error) {
    self._sound.outgoing.stop();
    throw error;
  });
};

/**
 * Join a {@link Conversation}.
 * <br><br>
 * By default, this will attempt to setup audio and video {@link Stream}s
 * between {@link RemoteEndpoint}s. You can override this by specifying
 * @instance
 * @param {Conversation} conversation - the {@link Conversation} to join
 * @returns {Promise<Conversation>}
 */
// TODO(mroberts): I'm pretty sure constraints do not work right now.
Endpoint.prototype.join = function join(conversation, options) {
  var self = this;
  // TODO(mroberts): This should be a function on UserAgent.
  var pending = [];
  this._userAgent._pending.forEach(function(dialog) {
    if (dialog.conversation === conversation) {
      pending.push(dialog);
    }
  });
  if (pending.length === 0) {
    self._sound.outgoing.play();
    return conversation.invite(this, options).then(function() {
      self._sound.outgoing.stop();
      return conversation;
    }, function(error) {
      self._sound.outgoing.stop();
      return error;
    });
  }
  // TODO(mroberts): Here's another thing: we need to search the current
  // conversation remoteendpoints, find those that we do not have pending dialogs for,
  // and create new ones. Hmm...
  return Q.all(pending.map(function(dialog) {
    return self._userAgent.accept(dialog, options);
  })).then(util.return(conversation));
};

/**
 * Leave one or more {@link Conversation}s. If no {@link Conversation} is provided this
 * leaves <em>all</em> {@link Conversation}s the {@link Endpoint} is active in.
 * @instance
 * @param {Conversation|Array<Conversation>} [conversation] - one or more {@link Conversation}s to leave
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.leave = function leave(conversation) {
  var self = this;
  var conversations = conversation ? [conversation] : this.conversations;
  var dialogs = [];
  conversations.forEach(function(conversation) {
    conversation._dialogs.forEach(function(dialog) {
      if (dialog.from === self._userAgent || dialog.to === self._userAgent) {
        dialogs.push(dialog.end());
      }
    });
  });
  return Q.all(dialogs).then(function() {
    conversations.forEach(function(conversation) {
      self.conversations.delete(conversation);
    });
    return self;
  }, function() {
    conversations.forEach(function(conversation) {
      self.conversations.delete(conversation);
    });
    return self;
  });
};

/**
 * Mute or unmute any audio this {@link Endpoint} is streaming in one or more
 * {@link Conversation}s. If no {@link Conversation} is provided, then this method mutes
 * or unmutes audio for <em>all</em> of this {@link Endpoint}'s
 * {@link Conversation}s.
 * @instance
 * @param {boolean} [mute=true] - whether to mute or unmute audio (defaults to mute)
 * @param {Conversation|Array<Conversation>} [conversation] - one or more {@link Conversation}s to
 *   mute or unmute audio for
 * @returns {Endpoint}
 */
Endpoint.prototype.muteAudio = function muteAudio(mute, conversation) {
  var streams = [];
  if (!conversation) {
    this.streams.forEach(function(_streams) {
      streams = streams.concat(_streams);
    });
  } else if (conversation instanceof Conversation) {
    streams = this.streams.get(conversation);
  } else if (typeof conversation.reduceRight === 'function') {
    streams = conversation.reduceRight(function(streams, conversation) {
      return streams.concat(this.streams.get(conversation));
    }, []);
  }
  streams.forEach(function(stream) {
    stream.muted = mute;
  });
  return this;
};

/**
 * Pause or unpause any video this {@link Endpoint} is streaming in one or more
 * {@link Conversation}s. If no {@link Conversation} is provided, then this method pauses
 * or unpauses video for <em>all</em> of this {@link Endpoint}'s
 * {@link Conversation}s.
 * @instance
 * @param {boolean} [pause=true] - whether to pause or unpause audio (defaults to pause)
 * @param {Conversation|Array<Conversation>} [conversation] - one or more {@link Conversation}s to
 *   pause or unpause video for
 * @returns {Endpoint}
 */
Endpoint.prototype.pauseVideo = function pauseVideo(pause, conversation) {
  var streams = [];
  if (!conversation) {
    this.streams.forEach(function(_streams) {
      streams = streams.concat(_streams);
    });
  } else if (conversation instanceof Conversation) {
    streams = this.streams.get(conversation);
  } else if (typeof conversation.reduceRight === 'function') {
    streams = conversation.reduceRight(function(streams, conversation) {
      return streams.concat(this.streams.get(conversation));
    }, []);
  }
  streams.forEach(function(stream) {
    stream.paused = pause;
  });
  return this;
};

/**
 * Another {@link RemoteEndpoint} has invited the {@link Endpoint} to a
 * {@link Conversation}.
 * @event Twilio.Signal.Endpoint#invite
 * @param {Conversation} conversation - the {@link Conversation} the {@link Endpoint} has been
 *   invited to
 * @example
 * var alice = new Endpoint("SIGNAL_TOKEN");
 * alice.on('invite', function(conversation) {
 *   alice.join(conversation);
 * });
 */

/**
 * The {@link Endpoint} has successfully connected and registered to Twilio.
 * @event Twilio.Signal.Endpoint#online
 */

/**
 * The {@link Endpoint} has lost its connection to Twilio or its registration
 * has expired.
 * @event Twilio.Signal.Endpoint#offline
 */

/**
 * The {@link Endpoint} has encountered an error.
 * @param {Error} error - the Error object
 * @event Twilio.Signal.Endpoint#error
 */

function setupUserAgentListeners(endpoint, userAgent) {
  userAgent.on('invite', function(inviteServerTransaction) {
    var invite = new Invite(inviteServerTransaction);
    invite._promise.then(function(conversation) {
      endpoint.conversations.add(conversation);
    });
    endpoint.emit('invite', invite);
  });
  return endpoint;
}

module.exports = Endpoint;
