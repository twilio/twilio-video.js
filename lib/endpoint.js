'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Conversation = require('./conversation');
var Invite = require('./invite');
var Q = require('q');
var RemoteEndpoint = require('./remoteendpoint');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var Sound = require('./media/sound');
var Token = require('./token');
var util = require('./util');

/**
 * Construct a new {@link Endpoint}.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and
 *   can create or join {@link Conversation}s with other
 *   {@link RemoteEndpoint}s.
 * @augments RemoteEndpoint
 * @param {(Token|string)} token - the
 *   {@link Endpoint}'s {@link Token}
 * @property {string} address - the {@link Endpoint}'s address
 *   (defined by its {@link Token})
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this
 *   {@link Endpoint} is active in
 * @fires Endpoint#invite
 * @fires Endpoint#online
 * @fires Endpoint#offline
 * @fires Endpoint#error
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(token, options);
  }
  var self = this;
  RemoteEndpoint.call(this);

  token = typeof token === 'string' ? new Token(token) : token;
  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'register': true,
    'sound': Sound.getDefault(),
    'userAgent': SIPJSUserAgent
  });

  var address = token.incomingClientName;
  var accountSid = token.accountSid;
  var sound = options['sound'];
  var userAgent = new options['userAgent'](token, options);

  userAgent.on('invite', function(inviteServerTransaction) {
    var invite = new Invite(inviteServerTransaction);
    invite._promise.then(function(conversation) {
      self.conversations.add(conversation);
    });
    self.emit('invite', invite);
  });

  Object.defineProperties(this, {
    '_options': {
      value: options
    },
    '_sound': {
      value: sound
    },
    '_userAgent': {
      value: userAgent
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

  if (options['register']) {
    this.register();
  }

  return Object.freeze(this);
}

inherits(Endpoint, RemoteEndpoint);

/**
 * Unregisters this {@link Endpoint}. This
 *   {@link Endpoint} will not receive {@link Conversation}
 *   invites until it calls {@link Endpoint#register} again.
 * @instance
 * @fires Endpoint#unregistered
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
 * Registers this {@link Endpoint} with address specified in the
 *   {@link Token} when you constructed the {@link Endpoint}.
 *   This enables other {@link RemoteEndpoint}s to invite this
 *   {@link Endpoint} to {@link Conversation}s.
 * @instance
 * @param {(Token|string)} [token] - a new {@link Token} or {@link Token}
 *   string to register with
 * @fires Endpoint#registered
 * @fires Endpoint#registrationFailed
 * @returns {Promise<Endpoint>}
 */
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
 * Create a {@link Conversation} and invite the specified
 *   {@link RemoteEndpoint}s to join.
 *   <br><br>
 *   By default, this will attempt to setup audio and video
 *   {@link Stream}s between {@link RemoteEndpoint}s. You can
 *   override this by specifying <code>constraints</code>.
 * @param {(RemoteEndpoint|string|Array<RemoteEndpoint|string>)}
 *   [remoteendpoints] - one or more {@link RemoteEndpoint}s or
 *   {@link RemoteEndpoint} addresses to invite to the {@link Conversation}
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}]
 * @returns {Promise<Conversation>}
 */
Endpoint.prototype.createConversation =
  function createConversation(address, options)
{
  var self = this;
  this._sound.outgoing.play();

  var addresses = address.forEach ? address : [address];
  options = util.withDefaults(options, this._options);

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
 * Leave one or more {@link Conversation}s. If no {@link Conversation} is
 *   provided this leaves <em>all</em> {@link Conversation}s the
 *   {@link Endpoint} is active in.
 * @instance
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to leave
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
 * Mute or unmute any audio this {@link Endpoint} is streaming in
 *   one or more {@link Conversation}s. If no {@link Conversation} is provided,
 *   then this method mutes or unmutes audio for <em>all</em> of this
 *   {@link Endpoint}'s {@link Conversation}s.
 * @instance
 * @param {boolean} [mute=true] - whether to mute or unmute audio (defaults to
 *   mute)
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to mute or unmute audio for
 * @returns {Endpoint}
 */
Endpoint.prototype.muteAudio = function muteAudio(mute, conversation) {
  throw new Error('Not implemented');
};

/**
 * Pause or unpause any video this {@link Endpoint} is streaming
 *   in one or more {@link Conversation}s. If no {@link Conversation} is
 *   provided, then this method pauses or unpauses video for <em>all</em> of
 *   this {@link Endpoint}'s {@link Conversation}s.
 * @instance
 * @param {boolean} [pause=true] - whether to pause or unpause audio
 *   (defaults to pause)
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to pause or unpause video for
 * @returns {Endpoint}
 */
Endpoint.prototype.pauseVideo = function pauseVideo(pause, conversation) {
  throw new Error('Not implemented');
};

module.exports = Endpoint;
